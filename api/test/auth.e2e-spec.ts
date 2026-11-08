import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { SessionService } from '../src/modules/auth/session.service';
import { DirectorySyncScheduler } from '../src/modules/users/directory-sync.scheduler';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { directoryStub } from './directory.stub';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('auth e2e', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    // Directory giả: sync thành công mà không cần PMH ID thật
    const directory = directoryStub();
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('callback ?error=access_denied → 302 về /?login=forbidden', async () => {
    const tx = JSON.stringify({ codeVerifier: 'v', state: 'x' });
    const res = await request(app.getHttpServer())
      .get('/api/auth/callback?error=access_denied&state=x')
      .set('Cookie', `vpp_oidc_tx=${encodeURIComponent(tx)}`)
      .expect(302);
    expect(res.headers.location).toMatch(/\/\?login=forbidden$/);
  });

  describe('logout với phiên cookie', () => {
    let sessionId: string;
    let csrfToken: string;

    beforeAll(async () => {
      const sub = `e2e-${randomUUID()}`;
      await app.get(UsersService).upsertFromClaims({ sub, full_name: 'E2E' });
      const session = await app.get(SessionService).create({
        userSub: sub,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims: { sub, full_name: 'E2E' },
        idToken: null,
      });
      sessionId = session.id;
      csrfToken = session.csrfToken;
    });

    it('thiếu X-CSRF-Token → 403 CSRF_TOKEN_INVALID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', `vpp_sid=${sessionId}`)
        .expect(403);
      expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('đúng X-CSRF-Token → 200 và phiên bị hủy', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', `vpp_sid=${sessionId}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `vpp_sid=${sessionId}`)
        .expect(401);
    });
  });

  it('GET auth/me (dev admin) trả shape cho web, có config.admin_contact', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
    expect(res.body).toMatchObject({
      sub: 'dev-admin',
      role: 'admin',
      csrfToken: null,
      config: {
        registration_last_day: 10,
        default_max_qty: 20,
        // config-admin e2e chạy song song có thể tạm đổi giá trị; ở đây chỉ kiểm shape
        admin_contact: expect.any(String) as string,
      },
    });
    for (const key of [
      'fullName',
      'email',
      'department',
      'employeeCode',
      'locale',
    ]) {
      expect(res.body).toHaveProperty(key);
    }
  });

  it('chưa có marker → tick sync ngay và ghi marker sau khi thành công', async () => {
    const scheduler = app.get(DirectorySyncScheduler);
    await scheduler.tick();
    await pool.query("DELETE FROM config WHERE key = 'directory_sync_last_at'");
    const before = Date.now();
    await scheduler.tick();
    const { rows } = await pool.query<{ value: string }>(
      "SELECT value FROM config WHERE key = 'directory_sync_last_at'",
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].value)).toBeGreaterThanOrEqual(before);
  });

  it('Directory trả danh sách rỗng khi VPP còn user SSO → đối chiếu hủy (empty), không ai bị no_access', async () => {
    const s = `auth-e2e-empty-${Date.now()}`;
    await pool.query(
      `INSERT INTO users (sub, full_name, status) VALUES ($1, $1, 'active')`,
      [s],
    );
    const res = await request(app.getHttpServer())
      .post('/api/admin/directory/sync')
      .set('x-dev-user-sub', 'dev-admin')
      .set('x-dev-role', 'admin')
      .expect(200);
    expect(res.body).toMatchObject({
      no_access: 0,
      reconcile: 'aborted',
      reconcile_reason: 'empty',
    });
    const { rows } = await pool.query<{ status: string }>(
      'SELECT status FROM users WHERE sub = $1',
      [s],
    );
    expect(rows[0].status).toBe('active');
    await pool.query('DELETE FROM users WHERE sub = $1', [s]);
  });

  it('POST admin/directory/sync với member → 403', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/directory/sync')
      .set('x-dev-user-sub', 'dev-member')
      .set('x-dev-role', 'member')
      .expect(403);
  });

  describe('GET admin/users', () => {
    const lockedSub = `e2e-locked-${randomUUID()}`;
    const deletedSub = `e2e-deleted-${randomUUID()}`;

    beforeAll(async () => {
      const users = app.get(UsersService);
      await users.ensureLocalSa();
      await users.upsertFromClaims({ sub: `e2e-${randomUUID()}` });
      await users.upsertFromClaims({ sub: lockedSub });
      await users.setStatus(lockedSub, 'locked');
      await users.upsertFromClaims({ sub: deletedSub });
      await users.setStatus(deletedSub, 'deleted');
    });

    it('member → 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('x-dev-user-sub', 'dev-member')
        .set('x-dev-role', 'member')
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('admin → 200, phân trang cursor, hiện user locked, ẩn deleted và local:sa', async () => {
      const server = app.getHttpServer();
      const subs: string[] = [];
      let cursor: string | null = null;
      do {
        const res: request.Response = await request(server)
          .get('/api/admin/users')
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set('x-dev-user-sub', 'dev-admin')
          .set('x-dev-role', 'admin')
          .expect(200);
        const body = res.body as {
          items: Array<{ sub: string }>;
          next_cursor: string | null;
        };
        expect(body.items.length).toBeLessThanOrEqual(2);
        subs.push(...body.items.map((u) => u.sub));
        cursor = body.next_cursor;
      } while (cursor);
      expect(subs.length).toBeGreaterThan(0);
      expect(new Set(subs).size).toBe(subs.length);
      expect(subs).not.toContain('local:sa');
      expect(subs).toContain(lockedSub);
      expect(subs).not.toContain(deletedSub);
    });
  });
});
