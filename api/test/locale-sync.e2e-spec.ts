import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as jose from 'jose';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { IDP_LOCALE_CLIENT } from '../src/modules/auth/idp-locale.client';
import type {
  IdpLocaleOptions,
  IdpLocaleResult,
} from '../src/modules/auth/idp-locale.client';
import { JwtVerifierService } from '../src/modules/auth/jwt-verifier.service';
import type { AppLocale } from '../src/modules/auth/locale';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import type { AuthUrlRequest } from '../src/modules/auth/oidc-provider';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const ISSUER = 'https://id.e2e-locale.test/oidc';
const CLIENT_ID = 'client_vpp_locale';
const SAVED_ENV = ['PMH_ISSUER_URL', 'PMH_CLIENT_ID', 'AUTH_DEV_MODE'].map(
  (k) => [k, process.env[k]] as const,
);

// Ngôn ngữ PMH ID (docs 7a) qua app thật: provider OIDC giả + client PUT /api/me/locale giả (không ra mạng)
describe('ngôn ngữ PMH ID: /me, ui_locales, PUT /api/auth/me/locale', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let privateKey: jose.CryptoKey;
  const SUFFIX = randomUUID().slice(0, 8);
  const sub = `e2e-locale-${SUFFIX}`;

  // Gọi IdP giả: handler đổi theo từng test; ghi lại token/locale/IP
  type Put = { token: string; locale: AppLocale; userIp?: string };
  let puts: Put[] = [];
  let onPut: (p: Put) => IdpLocaleResult | Promise<IdpLocaleResult> = (p) => ({
    ok: true,
    locale: p.locale,
  });
  const idpLocale = {
    putLocale: (token: string, locale: AppLocale, opts?: IdpLocaleOptions) => {
      const p = { token, locale, userIp: opts?.userIp };
      puts.push(p);
      return Promise.resolve(onPut(p));
    },
  };

  // Refresh giả: phát access token ký bằng key local, claim locale theo `accountLocale`
  let accountLocale: { locale: AppLocale; at: number } = {
    locale: 'vi',
    at: 0,
  };
  let refreshCount = 0;
  const authUrls: AuthUrlRequest[] = [];
  const logoutCalls: unknown[][] = [];
  const sign = (claims: Record<string, unknown>) => {
    const now = Math.floor(Date.now() / 1000);
    return new jose.SignJWT({ ver: 3, app_role: 'member', ...claims })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey);
  };
  const provider = {
    buildAuthUrl: (req: AuthUrlRequest) => {
      authUrls.push(req);
      return Promise.resolve('https://id.e2e-locale.test/oidc/auth');
    },
    exchangeCode: () => Promise.reject(new Error('không dùng')),
    refresh: async (rt: string) => {
      refreshCount += 1;
      return {
        accessToken: await sign({
          locale: accountLocale.locale,
          locale_updated_at: accountLocale.at,
          jti: `at-${refreshCount}`,
        }),
        refreshToken: `${rt}+`,
        idToken: null,
      };
    },
    buildLogoutUrl: (...args: unknown[]) => {
      logoutCalls.push(args);
      return Promise.resolve('https://id.e2e-locale.test/oidc/logout');
    },
    clientCredentialsToken: () => Promise.resolve('m2m'),
  };

  const openSso = (claims: Record<string, unknown> = {}) =>
    app.get(SessionService).create({
      userSub: sub,
      refreshToken: 'rt',
      accessToken: 'at-old',
      accessTokenExp: new Date(Date.now() + 5 * 60_000),
      claims: { sub, full_name: 'Locale', ...claims },
      idToken: null,
    });
  const me = (sid: string) =>
    request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${sid}`)
      .expect(200);
  const putLocale = (
    s: { id: string; csrfToken: string },
    body: Record<string, unknown>,
  ) =>
    request(app.getHttpServer())
      .put('/api/auth/me/locale')
      .set('Cookie', `vpp_sid=${s.id}`)
      .set('X-CSRF-Token', s.csrfToken)
      .send(body);

  beforeAll(async () => {
    process.env.PMH_ISSUER_URL = ISSUER;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    process.env.AUTH_DEV_MODE = 'true';
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    app = (await createTestApp(
      [],
      [
        { token: OIDC_PROVIDER, useValue: provider },
        { token: IDP_LOCALE_CLIENT, useValue: idpLocale },
      ],
    )) as INestApplication<App>;
    const pair = await jose.generateKeyPair('RS256');
    privateKey = pair.privateKey;
    app.get(JwtVerifierService).setKeySource(
      jose.createLocalJWKSet({
        keys: [await jose.exportJWK(pair.publicKey)],
      }),
    );
    await app
      .get(UsersService)
      .upsertFromClaims({ sub, full_name: 'Locale', app_role: 'member' });
  });

  beforeEach(() => {
    puts = [];
    onPut = (p) => ({ ok: true, locale: p.locale });
    refreshCount = 0;
    accountLocale = { locale: 'vi', at: 0 };
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.end();
    for (const [k, v] of SAVED_ENV) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  describe('GET /me', () => {
    it('phiên SSO: locale + localeUpdatedAt từ claim, serverTime = giờ máy chủ (ms)', async () => {
      const s = await openSso({
        locale: 'en',
        locale_updated_at: 1_762_000_000,
      });
      const before = Date.now();
      const res = await me(s.id);
      expect(res.body).toMatchObject({
        locale: 'en',
        localeUpdatedAt: 1_762_000_000,
      });
      expect(res.body.serverTime).toBeGreaterThanOrEqual(before);
      expect(res.body.serverTime).toBeLessThanOrEqual(Date.now());
    });

    it('phiên SSO thiếu claim locale → vi, localeUpdatedAt null', async () => {
      const s = await openSso();
      const res = await me(s.id);
      expect(res.body).toMatchObject({ locale: 'vi', localeUpdatedAt: null });
    });

    it('SA local và dev mode → locale null (web giữ ngôn ngữ trình duyệt)', async () => {
      const sa = await app.get(SessionService).createLocalSa();
      const a = await me(sa.id);
      expect(a.body).toMatchObject({ locale: null, localeUpdatedAt: null });
      expect(typeof a.body.serverTime).toBe('number');
      const dev = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('x-dev-user-sub', 'dev-locale')
        .set('x-dev-role', 'member')
        .expect(200);
      expect(dev.body).toMatchObject({ locale: null, localeUpdatedAt: null });
      await app.get(SessionService).destroy(sa.id);
    });
  });

  describe('ui_locales', () => {
    it('GET /api/auth/login?ui_locales=en → gửi ui_locales=en sang authorize; lạ → không gửi', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/login?ui_locales=en')
        .expect(302);
      expect(authUrls.at(-1)?.uiLocales).toBe('en');
      await request(app.getHttpServer())
        .get('/api/auth/login?ui_locales=vi&login_hint=a%40pmh.com.vn')
        .expect(302);
      expect(authUrls.at(-1)).toMatchObject({
        uiLocales: 'vi',
        loginHint: 'a@pmh.com.vn',
      });
      await request(app.getHttpServer())
        .get('/api/auth/login?ui_locales=fr')
        .expect(302);
      expect(authUrls.at(-1)?.uiLocales).toBeUndefined();
    });

    it('GET /api/auth/switch-account?ui_locales=en, không phiên → authorize prompt=login kèm ui_locales=en', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/switch-account?ui_locales=en')
        .expect(302);
      expect(res.headers.location).toBe('https://id.e2e-locale.test/oidc/auth');
      expect(authUrls.at(-1)).toMatchObject({
        prompt: 'login',
        uiLocales: 'en',
      });
    });

    it('GET /api/auth/switch-account?ui_locales=en, phiên có id_token → end_session kèm ui_locales=en', async () => {
      const s = await app.get(SessionService).create({
        userSub: sub,
        refreshToken: 'rt',
        accessToken: 'at-old',
        accessTokenExp: new Date(Date.now() + 5 * 60_000),
        claims: { sub, full_name: 'Locale' },
        idToken: 'idt',
      });
      const res = await request(app.getHttpServer())
        .get('/api/auth/switch-account?ui_locales=en')
        .set('Cookie', `vpp_sid=${s.id}`)
        .expect(302);
      expect(res.headers.location).toBe(
        'https://id.e2e-locale.test/oidc/logout',
      );
      expect(logoutCalls.at(-1)?.[2]).toBe('en');
    });
  });

  describe('PUT /api/auth/me/locale', () => {
    it('200 → saved:true; gọi IdP bằng access token phiên + IP; refresh một lần; /me trả en ngay', async () => {
      const s = await openSso({ locale: 'vi', locale_updated_at: 100 });
      onPut = (p) => {
        accountLocale = { locale: p.locale, at: Math.floor(Date.now() / 1000) };
        return { ok: true, locale: p.locale };
      };
      const res = await putLocale(s, { locale: 'en', page: 'pg1', seq: 1 })
        .set('X-Forwarded-For', '203.0.113.7')
        .expect(200);
      expect(res.body).toEqual({ locale: 'en', saved: true });
      expect(puts).toHaveLength(1);
      expect(puts[0]).toMatchObject({ token: 'at-old', locale: 'en' });
      expect(typeof puts[0].userIp).toBe('string');
      expect(refreshCount).toBe(1);
      expect((await me(s.id)).body.locale).toBe('en');
      const row = await app.get(SessionService).find(s.id);
      expect(row?.accessToken).not.toBe('at-old');
    });

    it('401 → refresh rồi thử lại bằng token mới → saved:true', async () => {
      const s = await openSso({ locale: 'vi' });
      onPut = (p) =>
        p.token === 'at-old'
          ? { ok: false, reason: 'unauthorized' }
          : { ok: true, locale: p.locale };
      const res = await putLocale(s, { locale: 'en' }).expect(200);
      expect(res.body).toEqual({ locale: 'en', saved: true });
      expect(puts.map((p) => p.token === 'at-old')).toEqual([true, false]);
      // refresh để thử lại + refresh sau khi lưu
      expect(refreshCount).toBe(2);
    });

    it.each([
      [{ ok: false, reason: 'forbidden' }, { reason: 'forbidden' }],
      [
        { ok: false, reason: 'rate_limited', retryAfterSec: 30 },
        { reason: 'rate_limited', retryAfterSec: 30 },
      ],
      [{ ok: false, reason: 'unavailable' }, { reason: 'unavailable' }],
    ])(
      'IdP %o → 200 saved:false, không 500, /me giữ claim',
      async (r, want) => {
        const s = await openSso({ locale: 'vi' });
        onPut = () => r as IdpLocaleResult;
        const res = await putLocale(s, { locale: 'en' }).expect(200);
        expect(res.body).toMatchObject({ locale: 'en', saved: false, ...want });
        expect(refreshCount).toBe(0);
        expect((await me(s.id)).body.locale).toBe('vi');
      },
    );

    it('client IdP ném (lỗi mạng) → 200 saved:false unavailable', async () => {
      const s = await openSso({ locale: 'vi' });
      onPut = () => Promise.reject(new TypeError('fetch failed'));
      const res = await putLocale(s, { locale: 'en' }).expect(200);
      expect(res.body).toMatchObject({ saved: false, reason: 'unavailable' });
    });

    it('lần bấm cũ (seq nhỏ hơn, cùng trang) tới sau → stale, không gọi IdP', async () => {
      const s = await openSso({ locale: 'vi' });
      await putLocale(s, { locale: 'en', page: 'pgX', seq: 2 }).expect(200);
      const res = await putLocale(s, {
        locale: 'vi',
        page: 'pgX',
        seq: 1,
      }).expect(200);
      expect(res.body).toEqual({ locale: 'vi', saved: false, reason: 'stale' });
      expect(puts.map((p) => p.locale)).toEqual(['en']);
    });

    it('SA local → local_session, không gọi IdP', async () => {
      const sa = await app.get(SessionService).createLocalSa();
      const res = await putLocale(sa, { locale: 'en' }).expect(200);
      expect(res.body).toEqual({
        locale: 'en',
        saved: false,
        reason: 'local_session',
      });
      expect(puts).toHaveLength(0);
      await app.get(SessionService).destroy(sa.id);
    });

    it('dev mode → local_session, không gọi IdP', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/auth/me/locale')
        .set('x-dev-user-sub', 'dev-locale')
        .set('x-dev-role', 'member')
        .send({ locale: 'en' })
        .expect(200);
      expect(res.body.reason).toBe('local_session');
      expect(puts).toHaveLength(0);
    });

    it('locale lạ → 400 INVALID_LOCALE; thiếu CSRF → 403', async () => {
      const s = await openSso();
      const bad = await putLocale(s, { locale: 'fr' }).expect(400);
      expect(bad.body.code).toBe('INVALID_LOCALE');
      await request(app.getHttpServer())
        .put('/api/auth/me/locale')
        .set('Cookie', `vpp_sid=${s.id}`)
        .send({ locale: 'en' })
        .expect(403);
      expect(puts).toHaveLength(0);
    });
  });
});
