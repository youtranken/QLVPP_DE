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
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

// Phiên cookie thật (không dùng x-dev-role) để đi qua toIdentity
describe('role tính mỗi request từ users.role', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let sessionId: string;
  const sub = `e2e-role-${randomUUID()}`;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    const directory = {
      fetchUsers: () => Promise.resolve([]),
    };
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
    await app.get(UsersService).upsertFromClaims({
      sub,
      full_name: 'Role E2E',
      app_role: 'admin',
      ver: 3,
    });
    const session = await app.get(SessionService).create({
      userSub: sub,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims: { sub, full_name: 'Role E2E', app_role: 'admin', ver: 3 },
      idToken: null,
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.end();
  });

  it("users.role='admin' (app_role admin lúc đăng nhập) → GET auth/me.role = admin, admin/audit 200", async () => {
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `vpp_sid=${sessionId}`)
      .expect(200);
    expect(me.body.role).toBe('admin');
    await request(app.getHttpServer())
      .get('/api/admin/audit')
      .set('Cookie', `vpp_sid=${sessionId}`)
      .expect(200);
  });
});
