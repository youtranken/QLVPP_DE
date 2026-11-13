import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import { sessionRef } from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const APP_URL = 'https://dev-vpp.example.test:8443';
const END_SESSION_URL = 'https://id.example.test/oidc/logout?id_token_hint=x';

const logoutCalls: unknown[][] = [];
let endSessionUrl: string | null = END_SESSION_URL;
const idp = {
  buildAuthUrl: () => Promise.resolve('https://id.example.test/authorize'),
  buildLogoutUrl: (...args: unknown[]) => {
    logoutCalls.push(args);
    return Promise.resolve(endSessionUrl);
  },
};

// Bấm "Đăng xuất" = thoát cả PMH ID (chủ dự án chốt 14/11, thay quyết định 12/11 chỉ thoát app):
// xóa phiên app + Nhật ký như cũ, rồi trả URL end_session kèm id_token_hint cho web chuyển sang
describe('POST auth/logout → end_session PMH ID', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const sub = `e2e-logout-${randomUUID().slice(0, 8)}`;
  const savedBase = process.env.APP_BASE_URL;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    process.env.APP_BASE_URL = APP_URL;
    app = (await createTestApp(
      [],
      [{ token: OIDC_PROVIDER, useValue: idp }],
    )) as INestApplication<App>;
    await app
      .get(UsersService)
      .upsertFromClaims({ sub, full_name: 'Logout', app_role: 'member' });
  });

  beforeEach(() => {
    logoutCalls.length = 0;
    endSessionUrl = END_SESSION_URL;
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.end();
    if (savedBase === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = savedBase;
  });

  const ssoSession = (idToken: string | null) =>
    app.get(SessionService).create({
      userSub: sub,
      refreshToken: 'rt',
      accessToken: 'at',
      accessTokenExp: new Date(Date.now() + 5 * 60_000),
      claims: { sub, full_name: 'Logout', app_role: 'member' },
      idToken,
    });

  const logout = (sid: string, csrf?: string, query = '') => {
    const req = request(app.getHttpServer())
      .post(`/api/auth/logout${query}`)
      .set('Cookie', `vpp_sid=${sid}`);
    return csrf ? req.set('X-CSRF-Token', csrf) : req;
  };

  const logoutAudits = async (sid: string) =>
    (
      await pool.query(
        `SELECT 1 FROM audit_log WHERE action = 'auth.logout' AND object_id = $1`,
        [sessionRef(sid)],
      )
    ).rowCount;

  it('phiên SSO có id_token → 200 {ok, redirectTo: end_session}, id_token_hint + post_logout_redirect_uri = APP_BASE_URL + ui_locales; phiên bị xóa, một auth.logout', async () => {
    const s = await ssoSession('id-token-logout');
    const res = await logout(s.id, s.csrfToken, '?ui_locales=en').expect(200);
    expect(res.body).toEqual({ ok: true, redirectTo: END_SESSION_URL });
    expect(logoutCalls).toEqual([[APP_URL, 'id-token-logout', 'en']]);
    expect(await app.get(SessionService).find(s.id)).toBeFalsy();
    expect(await logoutAudits(s.id)).toBe(1);
    // Cookie phiên bị xóa ở trình duyệt
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => /^vpp_sid=;/.test(c))).toBe(true);
  });

  it('ui_locales lạ/thiếu → không gửi ui_locales', async () => {
    const a = await ssoSession('id-a');
    await logout(a.id, a.csrfToken, '?ui_locales=fr').expect(200);
    const b = await ssoSession('id-b');
    await logout(b.id, b.csrfToken).expect(200);
    expect(logoutCalls).toHaveLength(2);
    expect(logoutCalls.map((c) => [c[1], c[2]])).toStrictEqual([
      ['id-a', undefined],
      ['id-b', undefined],
    ]);
  });

  it('phiên không có id_token (SA cục bộ, tài khoản thử) → chỉ thoát app: redirectTo null, không gọi end_session', async () => {
    const s = await ssoSession(null);
    const res = await logout(s.id, s.csrfToken).expect(200);
    expect(res.body).toEqual({ ok: true, redirectTo: null });
    expect(logoutCalls).toHaveLength(0);
    expect(await logoutAudits(s.id)).toBe(1);
  });

  it('SA cục bộ → redirectTo null', async () => {
    await app.get(UsersService).ensureLocalSa();
    const s = await app.get(SessionService).createLocalSa();
    const res = await logout(s.id, s.csrfToken).expect(200);
    expect(res.body).toEqual({ ok: true, redirectTo: null });
    expect(logoutCalls).toHaveLength(0);
  });

  it('PMH ID không có end_session (provider trả null) → vẫn đăng xuất app, redirectTo null', async () => {
    endSessionUrl = null;
    const s = await ssoSession('id-c');
    const res = await logout(s.id, s.csrfToken).expect(200);
    expect(res.body).toEqual({ ok: true, redirectTo: null });
    expect(await app.get(SessionService).find(s.id)).toBeFalsy();
  });

  it('thiếu X-CSRF-Token → 403, phiên còn nguyên, không gọi end_session', async () => {
    const s = await ssoSession('id-d');
    const res = await logout(s.id).expect(403);
    expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
    expect(logoutCalls).toHaveLength(0);
    expect(await app.get(SessionService).find(s.id)).toBeTruthy();
  });

  it('phiên đã tự hết (không còn trên server) → 401, không gọi end_session (hết phiên chỉ thoát app)', async () => {
    const s = await ssoSession('id-e');
    await app.get(SessionService).destroy(s.id);
    await logout(s.id, s.csrfToken).expect(401);
    expect(logoutCalls).toHaveLength(0);
  });
});
