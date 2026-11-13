import { INestApplication, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as jose from 'jose';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { cookieSecure } from '../src/modules/auth/auth.controller';
import { JwtVerifierService } from '../src/modules/auth/jwt-verifier.service';
import { hashPassword } from '../src/modules/auth/local-sa.service';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { SessionCleanupJob } from '../src/modules/auth/session-cleanup.job';
import {
  hashSessionId,
  openToken,
  sessionRef,
} from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const ISSUER = 'https://id.e2e-sh.test/oidc';
const CLIENT_ID = 'client_vpp_e2e_sh';
const SA_USER = 'sa-sh-e2e';
const SA_PASS = 'sa-sh-pass';
const TEST_PASS = 'test-sh-pass';
const SUFFIX = randomUUID().slice(0, 8);
const PMH_SUB = `e2e-sh-pmh-${SUFFIX}`;
const TEST_SUB = `local-test-e2e-sh-${SUFFIX}`;
const ENC_KEY = 'e2e-session-hash-key-0123456789abcdef0123';
const KEYS = [
  'PMH_ISSUER_URL',
  'PMH_CLIENT_ID',
  'LOCAL_SA_USERNAME',
  'LOCAL_SA_PASSWORD_HASH',
  'AUTH_DEV_MODE',
  'LOCAL_TEST_ACCOUNTS',
  'CONFIG_ENC_KEY',
] as const;
const LOG_METHODS = [
  'log',
  'warn',
  'error',
  'debug',
  'verbose',
  'fatal',
] as const;

// Chuẩn phiên chung (luật 1–8): cookie vpp_sid chỉ trình duyệt giữ; DB giữ sha256, Nhật ký/log giữ
// 12 hex đầu của hash; token PMH ID trong DB niêm phong v1: (AES-GCM). Không bảng phiên, bảng nhật ký
// hay log bắt được nào chứa nguyên cookie hoặc token — qua đăng nhập, đổi tài khoản, refresh, đăng
// xuất, hết hạn (12 h, idle SA) và job dọn.
describe('chuẩn phiên: cookie/token thô không nằm trong DB, Nhật ký, log', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let privateKey: jose.CryptoKey;
  let nextToken = '';
  let refreshCount = 0;
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  // Mọi cookie/token thô đã phát trong suite — cuối mỗi bước quét DB + log
  const secrets: string[] = [];
  const logs: string[] = [];
  const spies: jest.SpyInstance[] = [];

  const signAccess = async (): Promise<string> => {
    const iat = Math.floor(Date.now() / 1000);
    const token = await new jose.SignJWT({
      email: `${PMH_SUB}@pmh.test`,
      full_name: 'SH PMH',
      ver: 3,
      app_role: 'member',
      jti: randomUUID(),
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(PMH_SUB)
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(iat)
      .setExpirationTime(iat + 300)
      .sign(privateKey);
    secrets.push(token);
    return token;
  };
  const issued = (kind: string) => {
    const v = `${kind}-${SUFFIX}-${randomUUID()}`;
    secrets.push(v);
    return v;
  };
  let loginTokens = { refreshToken: '', idToken: '' };

  const provider = {
    buildAuthUrl: () => Promise.resolve('https://id.e2e-sh.test/auth'),
    exchangeCode: () =>
      Promise.resolve({
        accessToken: nextToken,
        refreshToken: loginTokens.refreshToken,
        idToken: loginTokens.idToken,
      }),
    refresh: async () => {
      refreshCount += 1;
      return {
        accessToken: await signAccess(),
        refreshToken: issued('rt-rotated'),
        idToken: null,
      };
    },
    buildLogoutUrl: () => Promise.resolve(null),
    clientCredentialsToken: () => Promise.resolve('m2m'),
  };

  const server = () => app.getHttpServer();
  const setCookieOf = (res: request.Response): string => {
    const raw = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => /^vpp_sid=[^;]/.test(c));
    expect(raw).toBeDefined();
    return raw!;
  };
  const cookieOf = (res: request.Response): string => {
    const header = setCookieOf(res);
    const value = /^vpp_sid=([^;]*)/.exec(header)?.[1];
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    secrets.push(value!);
    // Luật 5–6: cookie phiên trình duyệt (không Max-Age/Expires), HttpOnly, SameSite=Strict, Path=/
    expect(header).toMatch(/; HttpOnly/);
    expect(header).toMatch(/; SameSite=Strict/);
    expect(header).toMatch(/; Path=\/(;|$)/);
    expect(header).not.toMatch(/Max-Age|Expires/i);
    expect(/; Secure/.test(header)).toBe(cookieSecure());
    return value!;
  };
  const sessionRows = async (sub: string) =>
    (await pool.query('SELECT * FROM sessions WHERE user_sub = $1', [sub]))
      .rows as Record<string, unknown>[];
  const auditRows = async (actor: string, action: string) =>
    (
      await pool.query(
        'SELECT * FROM audit_log WHERE actor = $1 AND action = $2',
        [actor, action],
      )
    ).rows as Record<string, unknown>[];
  const auditApi = async (actor: string, action: string) =>
    (
      await request(server())
        .get('/api/admin/audit')
        .query({ actor, action })
        .set('x-dev-user-sub', 'dev-admin')
        .set('x-dev-role', 'admin')
        .expect(200)
    ).body as { items: Array<{ objectType: string; objectId: string }> };

  // Quét toàn bộ bảng sessions, mọi dòng Nhật ký của các actor trong suite và log bắt được
  async function expectNoSecretAnywhere(): Promise<void> {
    const sessions = JSON.stringify(
      (await pool.query('SELECT * FROM sessions')).rows,
    );
    const audits = JSON.stringify(
      (
        await pool.query('SELECT * FROM audit_log WHERE actor = ANY($1)', [
          [PMH_SUB, TEST_SUB, 'local:sa', 'system'],
        ])
      ).rows,
    );
    const logText = logs.join('\n');
    expect(secrets.length).toBeGreaterThan(0);
    for (const s of secrets) {
      expect(sessions).not.toContain(s);
      expect(audits).not.toContain(s);
      expect(logText).not.toContain(s);
    }
  }

  // Một phiên vừa tạo: khóa = sha256(cookie); Nhật ký (DB + API) objectId = 12 hex đầu của hash
  async function expectHashedSession(
    sub: string,
    action: string,
    cookie: string,
  ): Promise<void> {
    const rows = await sessionRows(sub);
    expect(rows).toHaveLength(1);
    expect(rows[0].id_hash).toBe(hashSessionId(cookie));
    const audits = await auditRows(sub, action);
    expect(audits.map((a) => a.object_id)).toContain(sessionRef(cookie));
    const api = await auditApi(sub, action);
    const item = api.items.find((i) => i.objectId === sessionRef(cookie));
    expect(item?.objectType).toBe('session');
    expect(item?.objectId).toMatch(/^[0-9a-f]{12}$/);
    await expectNoSecretAnywhere();
  }

  const me = (cookie: string) =>
    request(server()).get('/api/auth/me').set('Cookie', `vpp_sid=${cookie}`);

  async function pmhLogin(): Promise<string> {
    nextToken = await signAccess();
    loginTokens = { refreshToken: issued('rt'), idToken: issued('idt') };
    const tx = JSON.stringify({ codeVerifier: 'v', state: 'st' });
    const res = await request(server())
      .get('/api/auth/callback?code=c&state=st')
      .set('Cookie', `vpp_oidc_tx=${encodeURIComponent(tx)}`)
      .expect(302);
    expect(res.headers.location).toBe('/');
    return cookieOf(res);
  }

  async function saLogin(): Promise<string> {
    const res = await request(server())
      .post('/api/auth/sa-login')
      .send({ username: SA_USER, password: SA_PASS })
      .expect(200);
    return cookieOf(res);
  }

  async function cleanup(): Promise<void> {
    await pool.query('DELETE FROM sessions WHERE user_sub = ANY($1)', [
      [PMH_SUB, TEST_SUB, 'local:sa'],
    ]);
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    process.env.PMH_ISSUER_URL = ISSUER;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    process.env.LOCAL_SA_USERNAME = SA_USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(SA_PASS);
    process.env.AUTH_DEV_MODE = 'true';
    process.env.CONFIG_ENC_KEY = ENC_KEY;
    process.env.LOCAL_TEST_ACCOUNTS = JSON.stringify([
      {
        username: 'sh.e2e',
        password_hash: hashPassword(TEST_PASS),
        role: 'member',
        sub: TEST_SUB,
        name: 'SH E2E',
      },
    ]);
    // Bắt mọi log Nest (Logger) và console — app test tắt in ra, nhưng lời gọi vẫn đi qua đây
    const capture = (...args: unknown[]) => {
      logs.push(
        args
          .map((a) =>
            a instanceof Error
              ? `${a.message}\n${a.stack ?? ''}`
              : typeof a === 'string'
                ? a
                : JSON.stringify(a),
          )
          .join(' '),
      );
    };
    for (const m of LOG_METHODS) {
      spies.push(
        jest.spyOn(Logger.prototype, m).mockImplementation(capture as never),
        jest.spyOn(Logger, m).mockImplementation(capture as never),
      );
    }
    for (const m of ['log', 'warn', 'error', 'info', 'debug'] as const) {
      spies.push(jest.spyOn(console, m).mockImplementation(capture));
    }
    await cleanup();
    app = (await createTestApp(
      [],
      [
        { token: OIDC_PROVIDER, useValue: provider },
        { token: DIRECTORY_CLIENT, useValue: directoryStub() },
      ],
    )) as INestApplication<App>;
    const pair = await jose.generateKeyPair('RS256');
    privateKey = pair.privateKey;
    app.get(JwtVerifierService).setKeySource(
      jose.createLocalJWKSet({
        keys: [await jose.exportJWK(pair.publicKey)],
      }),
    );
  });

  afterAll(async () => {
    await app.close();
    for (const s of spies) s.mockRestore();
    await cleanup();
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [
      [PMH_SUB, TEST_SUB],
    ]);
    await pool.end();
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('đăng nhập PMH ID: cookie 43 ký tự; token PMH ID niêm phong v1: mở lại đúng; DB/Nhật ký/log không chứa cookie hay token', async () => {
    const cookie = await pmhLogin();
    await expectHashedSession(PMH_SUB, 'auth.login', cookie);
    const [row] = await sessionRows(PMH_SUB);
    for (const col of ['refresh_token', 'access_token', 'id_token']) {
      expect(row[col]).toMatch(/^v1:/);
    }
    expect(openToken(row.refresh_token as string)).toBe(
      loginTokens.refreshToken,
    );
    expect(openToken(row.access_token as string)).toBe(nextToken);
    expect(openToken(row.id_token as string)).toBe(loginTokens.idToken);
    await me(cookie).expect(200);
  });

  it('refresh token xoay vòng: token mới cũng niêm phong; không lộ ở đâu', async () => {
    const cookie = await pmhLogin();
    await pool.query(
      `UPDATE sessions SET access_token_exp = now() - interval '1 minute' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    const before = refreshCount;
    await me(cookie).expect(200);
    expect(refreshCount).toBe(before + 1);
    const row = (await sessionRows(PMH_SUB)).find(
      (r) => r.id_hash === hashSessionId(cookie),
    )!;
    expect(row.refresh_token).toMatch(/^v1:/);
    expect(openToken(row.refresh_token as string)).toMatch(/^rt-rotated-/);
    // refresh không phát id_token mới → giữ cái lúc login, vẫn niêm phong
    expect(openToken(row.id_token as string)).toBe(loginTokens.idToken);
    await expectNoSecretAnywhere();
  });

  it('đổi tài khoản (switch-account): xóa phiên theo hash, xóa cookie', async () => {
    await cleanup();
    const cookie = await pmhLogin();
    const res = await request(server())
      .get('/api/auth/switch-account')
      .set('Cookie', `vpp_sid=${cookie}`)
      .expect(302);
    expect(
      ([] as string[])
        .concat(res.headers['set-cookie'] ?? [])
        .some((c) => /^vpp_sid=;/.test(c)),
    ).toBe(true);
    expect(await sessionRows(PMH_SUB)).toHaveLength(0);
    await me(cookie).expect(401);
    await expectNoSecretAnywhere();
  });

  it('quá 12 h từ lúc đăng nhập: 401, xóa theo hash, auth.session_expired max_age có objectId 12 hex', async () => {
    const cookie = await pmhLogin();
    await pool.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    await me(cookie).expect(401);
    expect(await sessionRows(PMH_SUB)).toHaveLength(0);
    const expired = await pool.query<{ detail: unknown }>(
      `SELECT detail FROM audit_log
        WHERE actor = $1 AND action = 'auth.session_expired' AND object_id = $2`,
      [PMH_SUB, sessionRef(cookie)],
    );
    expect(expired.rows).toEqual([{ detail: { reason: 'max_age' } }]);
    await expectNoSecretAnywhere();
  });

  it('phiên mới hết hạn đúng 12 h sau lúc tạo', async () => {
    const cookie = await pmhLogin();
    const { rows } = await pool.query<{ hours: string }>(
      `SELECT extract(epoch FROM expires_at - created_at) / 3600 AS hours
         FROM sessions WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    expect(Number(rows[0].hours)).toBeCloseTo(12, 2);
  });

  it('đăng nhập SA: gửi giá trị hash trong DB làm cookie → 401 (cả tra thẳng service cũng không thấy)', async () => {
    await cleanup();
    const cookie = await saLogin();
    await expectHashedSession('local:sa', 'auth.sa_login', cookie);
    await me(cookie).expect(200);
    const stolen = hashSessionId(cookie);
    const rejected = await me(stolen).expect(401);
    expect(rejected.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await app.get(SessionService).find(stolen)).toBeNull();
    // Phiên thật vẫn sống: cookie giả chỉ bị từ chối, không đụng phiên
    await me(cookie).expect(200);
  });

  it('đăng nhập tài khoản thử rồi đăng xuất: xóa theo hash, auth.logout cùng objectId', async () => {
    const res = await request(server())
      .post('/api/auth/test-login')
      .send({ username: 'sh.e2e', password: TEST_PASS })
      .expect(200);
    const cookie = cookieOf(res);
    await expectHashedSession(TEST_SUB, 'auth.test_login', cookie);

    const csrf = ((await me(cookie).expect(200)).body as { csrfToken: string })
      .csrfToken;
    await request(server())
      .post('/api/auth/logout')
      .set('Cookie', `vpp_sid=${cookie}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);
    expect(await sessionRows(TEST_SUB)).toHaveLength(0);
    const out = await auditRows(TEST_SUB, 'auth.logout');
    expect(out.map((a) => a.object_id)).toEqual([sessionRef(cookie)]);
    await me(cookie).expect(401);
    await expectNoSecretAnywhere();
  });

  it('phiên SA idle quá 2 h: xóa theo hash, auth.session_expired local_sa_idle có objectId 12 hex', async () => {
    await cleanup();
    const cookie = await saLogin();
    await pool.query(
      `UPDATE sessions SET last_seen_at = now() - interval '3 hours' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    await me(cookie).expect(401);
    expect(await sessionRows('local:sa')).toHaveLength(0);
    const expired = await pool.query<{ detail: unknown }>(
      `SELECT detail FROM audit_log
        WHERE actor = 'local:sa' AND action = 'auth.session_expired' AND object_id = $1`,
      [sessionRef(cookie)],
    );
    expect(expired.rows).toEqual([{ detail: { reason: 'local_sa_idle' } }]);
    await expectNoSecretAnywhere();
  });

  it('job dọn phiên: xóa phiên quá 12 h, giữ phiên còn hạn; log chỉ ghi số lượng', async () => {
    await cleanup();
    const sessions = app.get(SessionService);
    const old = await sessions.createLocalSa();
    const fresh = await sessions.createLocalSa();
    secrets.push(old.id, fresh.id);
    await pool.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id_hash = $1`,
      [hashSessionId(old.id)],
    );
    await app.get(SessionCleanupJob).run();
    const left = (await sessionRows('local:sa')).map((r) => r.id_hash);
    expect(left).toEqual([hashSessionId(fresh.id)]);
    expect(logs.some((l) => /dọn \d+ phiên quá hạn/.test(l))).toBe(true);
    await expectNoSecretAnywhere();
  });
});
