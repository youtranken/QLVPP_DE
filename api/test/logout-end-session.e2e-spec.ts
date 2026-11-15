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
const END_SESSION_URL = 'https://id.example.test/oidc/logout?x=1';

const logoutCalls: unknown[][] = [];
let endSessionUrl: string | null = END_SESSION_URL;
const idp = {
  buildAuthUrl: () => Promise.resolve('https://id.example.test/authorize'),
  buildLogoutUrl: (...args: unknown[]) => {
    logoutCalls.push(args);
    return Promise.resolve(endSessionUrl);
  },
};

// Nút Đăng xuất = thoát trình duyệt này khỏi Tài khoản D&E và mọi app: form POST điều hướng cả trang, server xóa phiên app
// rồi 303 sang /oidc/logout — id_token không bao giờ xuống trình duyệt ngoài URL chuyển hướng
describe('POST auth/logout → 303 end_session PMH ID', () => {
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

  // Như trình duyệt gửi form cùng trang: Origin = app, thân x-www-form-urlencoded
  const logout = (
    form: Record<string, string>,
    opts: { sid?: string; origin?: string | null } = {},
  ) => {
    const req = request(app.getHttpServer()).post('/api/auth/logout');
    if (opts.sid) req.set('Cookie', `vpp_sid=${opts.sid}`);
    if (opts.origin !== null) req.set('Origin', opts.origin ?? APP_URL);
    return req.type('form').send(form);
  };

  const logoutAudits = async (sid: string) =>
    (
      await pool.query(
        `SELECT 1 FROM audit_log WHERE action = 'auth.logout' AND object_id = $1`,
        [sessionRef(sid)],
      )
    ).rowCount;

  it('phiên SSO + csrf đúng → 303 end_session (id_token_hint, post_logout_redirect_uri = APP_BASE_URL, ui_locales); phiên bị xóa, một auth.logout, xóa cookie, không trả thân JSON', async () => {
    const s = await ssoSession('id-token-logout');
    const res = await logout(
      { csrf: s.csrfToken, ui_locales: 'en' },
      { sid: s.id },
    ).expect(303);
    expect(res.headers.location).toBe(END_SESSION_URL);
    expect(logoutCalls).toEqual([[APP_URL, 'id-token-logout', 'en']]);
    expect(await app.get(SessionService).find(s.id)).toBeFalsy();
    expect(await logoutAudits(s.id)).toBe(1);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => /^vpp_sid=;/.test(c))).toBe(true);
    expect(res.text).not.toContain('{');
  });

  it('ui_locales lạ/thiếu → không gửi ui_locales', async () => {
    const a = await ssoSession('id-a');
    await logout({ csrf: a.csrfToken, ui_locales: 'fr' }, { sid: a.id });
    const b = await ssoSession('id-b');
    await logout({ csrf: b.csrfToken }, { sid: b.id });
    expect(logoutCalls).toHaveLength(2);
    expect(logoutCalls.map((c) => [c[1], c[2]])).toStrictEqual([
      ['id-a', undefined],
      ['id-b', undefined],
    ]);
  });

  it('csrf sai/thiếu → 303 về /, phiên còn nguyên, không gọi end_session, không auth.logout', async () => {
    const s = await ssoSession('id-d');
    for (const form of [{ csrf: 'sai' }, {}] as Record<string, string>[]) {
      const res = await logout(form, { sid: s.id }).expect(303);
      expect(res.headers.location).toBe('/');
    }
    expect(logoutCalls).toHaveLength(0);
    expect(await app.get(SessionService).find(s.id)).toBeTruthy();
    expect(await logoutAudits(s.id)).toBe(0);
  });

  it('phiên không có id_token (tài khoản thử) và SA cục bộ → chỉ thoát app: 303 về /, không gọi end_session', async () => {
    const t = await ssoSession(null);
    const r1 = await logout({ csrf: t.csrfToken }, { sid: t.id }).expect(303);
    expect(r1.headers.location).toBe('/');
    expect(await logoutAudits(t.id)).toBe(1);
    await app.get(UsersService).ensureLocalSa();
    const sa = await app.get(SessionService).createLocalSa();
    const r2 = await logout({ csrf: sa.csrfToken }, { sid: sa.id }).expect(303);
    expect(r2.headers.location).toBe('/');
    expect(logoutCalls).toHaveLength(0);
  });

  it('PMH ID không có end_session → vẫn thoát app, 303 về /', async () => {
    endSessionUrl = null;
    const s = await ssoSession('id-c');
    const res = await logout({ csrf: s.csrfToken }, { sid: s.id }).expect(303);
    expect(res.headers.location).toBe('/');
    expect(await app.get(SessionService).find(s.id)).toBeFalsy();
  });

  it('không còn phiên app (đã hết / cookie cũ) nhưng người dùng bấm Đăng xuất từ chính app → vẫn end_session, không id_token_hint', async () => {
    const s = await ssoSession('id-e');
    await app.get(SessionService).destroy(s.id);
    const res = await logout(
      { csrf: s.csrfToken, ui_locales: 'vi' },
      { sid: s.id },
    ).expect(303);
    expect(res.headers.location).toBe(END_SESSION_URL);
    expect(logoutCalls).toEqual([[APP_URL, null, 'vi']]);
    // Sec-Fetch-Site cũng đủ chứng minh cùng trang (trình duyệt không gửi Origin)
    const r2 = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'same-origin')
      .type('form')
      .send({})
      .expect(303);
    expect(r2.headers.location).toBe(END_SESSION_URL);
  });

  it('không phiên + form từ trang khác (Origin lạ / không có Origin, Sec-Fetch-Site cross-site) → 303 về /, không đẩy người dùng ra khỏi PMH ID', async () => {
    await logout({}, { origin: 'https://evil.example' }).expect(303);
    await logout({}, { origin: null }).expect(303);
    const r = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'cross-site')
      .type('form')
      .send({});
    expect(r.status).toBe(303);
    expect(r.headers.location).toBe('/');
    expect(logoutCalls).toHaveLength(0);
  });

  it('không phiên + local=1 (web đang ở phiên SA cục bộ) → 303 về /, không gọi end_session', async () => {
    const res = await logout({ local: '1' }).expect(303);
    expect(res.headers.location).toBe('/');
    expect(logoutCalls).toHaveLength(0);
  });
});
