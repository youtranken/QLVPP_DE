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

// Phiên cookie thật: dev-identity mang vai cố định trong header nên không thấy vai tính lại từ users.role
describe('vai Hành chính đọc users.role mỗi request (app_role PMH ID v3)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId: string;
  const subAdmin = `e2e-approle-hc-${randomUUID()}`;
  const subMember = `e2e-approle-nv-${randomUUID()}`;
  const sessions: Record<string, { id: string; csrf: string }> = {};

  const http = () => request(app.getHttpServer());
  const setRole = (sub: string, role: 'admin' | 'member') =>
    pool.query('UPDATE users SET role = $2 WHERE sub = $1', [sub, role]);
  const get = (sub: string, path: string) =>
    http().get(path).set('Cookie', `vpp_sid=${sessions[sub].id}`);
  // Mỗi lần lưu từ phiếu trống: ca này kiểm vai, không kiểm expected_updated_at
  const saveLines = async (sub: string) => {
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [sub]);
    const ym = (await get(sub, '/api/periods/current').expect(200)).body
      .ym as string;
    return http()
      .put('/api/me/request/lines')
      .set('Cookie', `vpp_sid=${sessions[sub].id}`)
      .set('X-CSRF-Token', sessions[sub].csrf)
      .send({ ym, lines: [{ item_id: itemId, qty: 1 }] });
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    app = (await createTestApp(
      [],
      [
        {
          token: DIRECTORY_CLIENT,
          useValue: { fetchUsers: () => Promise.resolve([]) },
        },
      ],
    )) as INestApplication<App>;
    for (const [sub, appRole] of [
      [subAdmin, 'admin'],
      [subMember, 'member'],
    ] as const) {
      const claims = {
        sub,
        full_name: `App role ${appRole}`,
        app_role: appRole,
        ver: 3,
      };
      await app.get(UsersService).upsertFromClaims(claims);
      const s = await app.get(SessionService).create({
        userSub: sub,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims,
        idToken: null,
      });
      sessions[sub] = { id: s.id, csrf: s.csrfToken };
    }
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit) VALUES ($1, 'cay') RETURNING id`,
        [`e2e-approle-item-${subMember}`],
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    const subs = [subAdmin, subMember];
    await pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [subs]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM sessions WHERE user_sub = ANY($1)', [subs]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [subs]);
    await pool.end();
  });

  it('users.role=admin → auth/me.role admin, admin/audit 200; UPDATE role=member → request kế 403 FORBIDDEN_ROLE, me/requests 200', async () => {
    const me = await get(subAdmin, '/api/auth/me').expect(200);
    expect(me.body.role).toBe('admin');
    await get(subAdmin, '/api/admin/audit').expect(200);

    await setRole(subAdmin, 'member');
    expect((await get(subAdmin, '/api/auth/me').expect(200)).body.role).toBe(
      'member',
    );
    const blocked = await get(subAdmin, '/api/admin/audit').expect(403);
    expect(blocked.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });
    await get(subAdmin, '/api/me/requests').expect(200);
  });

  it('member lưu phiếu 200; đổi role admin → 403 FORBIDDEN_ROLE; đổi lại → 200', async () => {
    expect((await saveLines(subMember)).status).toBe(200);

    await setRole(subMember, 'admin');
    const blocked = await saveLines(subMember);
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });

    await setRole(subMember, 'member');
    expect((await saveLines(subMember)).status).toBe(200);
  });
});
