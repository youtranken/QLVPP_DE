import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { SessionService } from '../src/modules/auth/session.service';
import { DIRECTORY_CLIENT } from '../src/modules/users/directory.client';
import { UsersService } from '../src/modules/users/users.service';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const GROUP = `e2e-grp-${randomUUID().slice(0, 8)}`;

// Người bị đổi vai dùng phiên cookie thật: dev-identity mang vai cố định trong header nên không thấy vai tính lại
describe('đổi config.admin_group qua PUT admin/config', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let sessionId: string;
  let original: unknown;
  const sub = `e2e-admgrp-${randomUUID()}`;
  const savedDev = process.env.AUTH_DEV_MODE;

  const role = async () =>
    (
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `vpp_sid=${sessionId}`)
        .expect(200)
    ).body.role as string;
  const setAdminGroup = (value: string) =>
    request(app.getHttpServer())
      .put('/api/admin/config')
      .set('x-dev-user-sub', 'e2e-admgrp-hc')
      .set('x-dev-role', 'admin')
      .send({ admin_group: value })
      .expect(200);

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    original = (
      await pool.query("SELECT value FROM config WHERE key = 'admin_group'")
    ).rows[0].value;
    process.env.AUTH_DEV_MODE = 'true';
    const directory = {
      fetchUsers: () => Promise.resolve([]),
      fetchGroups: () => Promise.resolve([]),
    };
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
    await app
      .get(UsersService)
      .upsertFromClaims({ sub, full_name: 'Đổi nhóm', groups: [GROUP] });
    sessionId = (
      await app.get(SessionService).create({
        userSub: sub,
        refreshToken: null,
        accessTokenExp: new Date(Date.now() + 10 * 60_000),
        claims: { sub, full_name: 'Đổi nhóm', groups: [GROUP] },
        idToken: null,
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
    await pool.query("UPDATE config SET value = $1 WHERE key = 'admin_group'", [
      JSON.stringify(original),
    ]);
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.end();
    if (savedDev === undefined) delete process.env.AUTH_DEV_MODE;
    else process.env.AUTH_DEV_MODE = savedDev;
  });

  // Ghi qua API xóa cache → hiệu lực ngay (≤ 30 s); mép TTL 30 s khi sửa DB tay ở system-config.service.spec
  it('admin_group đổi sang nhóm của người dùng → request kế tiếp role admin; đổi lại → member', async () => {
    expect(await role()).toBe('member');
    await setAdminGroup(GROUP);
    expect(await role()).toBe('admin');
    await setAdminGroup(String(original));
    expect(await role()).toBe('member');
  });
});

// Phiên cookie thật: vai tính lại từ users.groups mỗi request, so admin_group không phân biệt hoa thường
describe('Hành chính không có phiếu: vai đổi theo users.groups ở request kế tiếp', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let sessionId: string;
  let csrfToken: string;
  let itemId: string;
  const sub = `e2e-admgrp-req-${randomUUID()}`;
  const savedDev = process.env.AUTH_DEV_MODE;

  const http = () => request(app.getHttpServer());
  const setGroups = (groups: string[]) =>
    pool.query('UPDATE users SET groups = $1::jsonb WHERE sub = $2', [
      JSON.stringify(groups),
      sub,
    ]);
  // Mỗi lần lưu từ phiếu trống: ca này kiểm vai, không kiểm expected_updated_at
  const saveLines = async () => {
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [sub]);
    const ym = (
      await http()
        .get('/api/periods/current')
        .set('Cookie', `vpp_sid=${sessionId}`)
        .expect(200)
    ).body.ym as string;
    return http()
      .put('/api/me/request/lines')
      .set('Cookie', `vpp_sid=${sessionId}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ ym, lines: [{ item_id: itemId, qty: 1 }] });
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    const adminGroup = (
      await pool.query("SELECT value FROM config WHERE key = 'admin_group'")
    ).rows[0].value;
    expect(adminGroup).toBe('vpp_admin');
    process.env.AUTH_DEV_MODE = 'true';
    const directory = {
      fetchUsers: () => Promise.resolve([]),
      fetchGroups: () => Promise.resolve([]),
    };
    app = (await createTestApp(
      [],
      [{ token: DIRECTORY_CLIENT, useValue: directory }],
    )) as INestApplication<App>;
    const claims = { sub, full_name: 'Đổi nhóm phiếu', groups: ['Test_VPP'] };
    await app.get(UsersService).upsertFromClaims(claims);
    const session = await app.get(SessionService).create({
      userSub: sub,
      refreshToken: null,
      accessTokenExp: new Date(Date.now() + 10 * 60_000),
      claims,
      idToken: null,
    });
    sessionId = session.id;
    csrfToken = session.csrfToken;
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit) VALUES ($1, 'cay') RETURNING id`,
        [`e2e-admgrp-item-${sub}`],
      )
    ).rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM sessions WHERE user_sub = $1', [sub]);
    await pool.query('DELETE FROM users WHERE sub = $1', [sub]);
    await pool.end();
    if (savedDev === undefined) delete process.env.AUTH_DEV_MODE;
    else process.env.AUTH_DEV_MODE = savedDev;
  });

  it('nhóm thường lưu phiếu 200; thêm VPP_ADMIN (admin_group vpp_admin) → 403 FORBIDDEN_ROLE; gỡ → 200', async () => {
    expect((await saveLines()).status).toBe(200);

    await setGroups(['Test_VPP', 'VPP_ADMIN']);
    const blocked = await saveLines();
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'FORBIDDEN_ROLE' });

    await setGroups(['Test_VPP']);
    expect((await saveLines()).status).toBe(200);
  });
});
