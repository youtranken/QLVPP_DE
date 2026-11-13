import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { newSessionCookie } from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { UsersService } from '../src/modules/users/users.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

// Rà soát 13/11 Gu #13: trang công khai log "401" mỗi lần tải vì boot web gọi auth/me khi chưa đăng nhập.
// GET auth/session = boot: ẩn danh → 204 không thân (không dữ liệu); có phiên → đúng thân của auth/me.
// GET auth/me giữ nguyên 401 (mọi test bảo mật khác dò phiên chết bằng nó).
describe('GET /api/auth/session (boot web)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const server = () => app.getHttpServer();
  const clearsCookie = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .some((c) => /^vpp_sid=;/.test(c));

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directoryStub() }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('không cookie → 204, thân rỗng; auth/me vẫn 401 UNAUTHENTICATED', async () => {
    const res = await request(server()).get('/api/auth/session').expect(204);
    expect(res.text).toBe('');
    expect(res.body).toEqual({});
    const me = await request(server()).get('/api/auth/me').expect(401);
    expect(me.body.code).toBe('UNAUTHENTICATED');
  });

  it('cookie rác → 204 và xóa cookie (như auth/me)', async () => {
    const res = await request(server())
      .get('/api/auth/session')
      .set('Cookie', 'vpp_sid=khong-phai-uuid')
      .expect(204);
    expect(res.text).toBe('');
    expect(clearsCookie(res)).toBe(true);
  });

  it('cookie đúng dạng không có phiên (đã đăng xuất / bị thu hồi) → 204 và xóa cookie', async () => {
    const res = await request(server())
      .get('/api/auth/session')
      .set('Cookie', `vpp_sid=${newSessionCookie()}`)
      .expect(204);
    expect(res.text).toBe('');
    expect(clearsCookie(res)).toBe(true);
  });

  it('cookie UUID của phiên cũ (trước khi băm khóa phiên) → 204 và xóa cookie', async () => {
    const res = await request(server())
      .get('/api/auth/session')
      .set('Cookie', `vpp_sid=${randomUUID()}`)
      .expect(204);
    expect(clearsCookie(res)).toBe(true);
  });

  it('phiên cookie hợp lệ → 200, cùng thân với auth/me (sub, csrfToken của phiên); đăng xuất xong → 204', async () => {
    const sub = `e2e-session-${randomUUID()}`;
    await app
      .get(UsersService)
      .upsertFromClaims({ sub, full_name: 'E2E Session' });
    const session = await app.get(SessionService).create({
      userSub: sub,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims: { sub, full_name: 'E2E Session' },
      idToken: null,
    });
    const cookie = `vpp_sid=${session.id}`;
    const [s, m] = await Promise.all([
      request(server())
        .get('/api/auth/session')
        .set('Cookie', cookie)
        .expect(200),
      request(server()).get('/api/auth/me').set('Cookie', cookie).expect(200),
    ]);
    expect(s.body).toMatchObject({
      sub,
      role: 'member',
      csrfToken: session.csrfToken,
      fullName: 'E2E Session',
    });
    const strip = (b: Record<string, unknown>) => ({ ...b, serverTime: 0 });
    expect(strip(s.body as Record<string, unknown>)).toEqual(
      strip(m.body as Record<string, unknown>),
    );

    await request(server())
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .expect(200);
    const after = await request(server())
      .get('/api/auth/session')
      .set('Cookie', cookie)
      .expect(204);
    expect(after.text).toBe('');
  });

  it('header dev (AUTH_DEV_MODE) → 200 với vai trò', async () => {
    const res = await request(server())
      .get('/api/auth/session')
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
    expect(res.body).toMatchObject({ sub: 'dev-admin', role: 'admin' });
  });

  it('chỉ GET: POST auth/session → 404 (không mở thêm lối ghi)', async () => {
    await request(server()).post('/api/auth/session').expect(404);
  });
});
