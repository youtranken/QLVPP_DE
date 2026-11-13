import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { OIDC_PROVIDER } from '../src/modules/auth/oidc-provider';
import type { AuthUrlRequest } from '../src/modules/auth/oidc-provider';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const LOGOUT_URL = 'https://id.example.test/logout';
const AUTH_URL = 'https://id.example.test/authorize';

const authCalls: AuthUrlRequest[] = [];
const logoutCalls: unknown[][] = [];
const idp = {
  buildAuthUrl: (req: AuthUrlRequest) => {
    authCalls.push(req);
    return Promise.resolve(AUTH_URL);
  },
  buildLogoutUrl: (...args: unknown[]) => {
    logoutCalls.push(args);
    return Promise.resolve(LOGOUT_URL);
  },
};

// "Đăng nhập bằng tài khoản khác" ở trang Chưa được cấp quyền: PMH ID ném 500 khi end_session thiếu id_token_hint
describe('GET auth/switch-account', () => {
  let app: INestApplication<App>;
  const sub = `e2e-switch-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL);
    app = (await createTestApp(
      [],
      [{ token: OIDC_PROVIDER, useValue: idp }],
    )) as INestApplication<App>;
    // Guard chỉ nhận phiên của user có trong bảng users
    await app
      .get(UsersService)
      .upsertFromClaims({ sub, full_name: 'Switch', app_role: 'member' });
  });

  beforeEach(() => {
    authCalls.length = 0;
    logoutCalls.length = 0;
  });

  afterAll(async () => {
    await app.close();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.end();
  });

  it('không có phiên (bị từ chối trước khi tạo phiên) → authorize prompt=login, không end_session thiếu hint', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/switch-account?ui_locales=en')
      .expect(302);
    expect(res.headers.location).toBe(AUTH_URL);
    expect(logoutCalls).toHaveLength(0);
    expect(authCalls).toHaveLength(1);
    expect(authCalls[0]).toMatchObject({ prompt: 'login', uiLocales: 'en' });
    expect(authCalls[0].redirectUri).toMatch(/\/api\/auth\/callback$/);
    // Cookie giao dịch PKCE/state cho callback
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('vpp_oidc_tx='))).toBe(true);
  });

  it('cookie vpp_sid rác (không phải UUID) → như không có phiên (authorize prompt=login), không 500', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/switch-account')
      .set('Cookie', 'vpp_sid=khong-phai-uuid')
      .expect(302);
    expect(res.headers.location).toBe(AUTH_URL);
    expect(authCalls[0]?.prompt).toBe('login');
  });

  it('phiên có id_token → end_session kèm id_token_hint, hủy phiên app', async () => {
    const sessions = app.get(SessionService);
    const s = await sessions.create({
      userSub: sub,
      refreshToken: 'rt',
      accessToken: 'at',
      accessTokenExp: new Date(Date.now() + 5 * 60_000),
      claims: { sub, full_name: 'Switch', app_role: 'member' },
      idToken: 'id-token-xyz',
    });
    const res = await request(app.getHttpServer())
      .get('/api/auth/switch-account?ui_locales=vi')
      .set('Cookie', `vpp_sid=${s.id}`)
      .expect(302);
    expect(res.headers.location).toBe(LOGOUT_URL);
    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0][1]).toBe('id-token-xyz');
    expect(logoutCalls[0][2]).toBe('vi');
    expect(authCalls).toHaveLength(0);
    expect(await sessions.find(s.id)).toBeFalsy();
  });
});
