import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const ADMIN_SUB = 'e2e-config-admin';

describe('admin/config + public-config', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let snapshot: Array<{ key: string; value: unknown }>;

  const asAdmin = (req: request.Test) =>
    req.set('x-dev-user-sub', ADMIN_SUB).set('x-dev-role', 'admin');
  const put = (body: unknown) =>
    asAdmin(request(app.getHttpServer()).put('/api/admin/config')).send(
      body as object,
    );

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    snapshot = (await pool.query('SELECT key, value FROM config')).rows;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    for (const row of snapshot) {
      await pool.query('UPDATE config SET value = $2 WHERE key = $1', [
        row.key,
        JSON.stringify(row.value),
      ]);
    }
    // Chỉ xóa khóa test này có thể lỡ ghi; suite khác chạy song song có marker riêng
    await pool.query('DELETE FROM config WHERE key = ANY($1)', [
      ['constructor', 'toString', '__proto__'],
    ]);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('GET public-config không phiên → 200 {admin_contact}, không lộ khóa khác', async () => {
    await put({ admin_contact: 'Chị Lan — 0901 234 567' }).expect(200);
    const res = await request(app.getHttpServer())
      .get('/api/public-config')
      .expect(200);
    expect(res.body).toEqual({ admin_contact: 'Chị Lan — 0901 234 567' });
  });

  it('GET admin/config: member → 403; admin → đủ khóa VPP', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/config')
      .set('x-dev-user-sub', 'e2e-config-member')
      .set('x-dev-role', 'member')
      .expect(403);
    const res = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(Object.keys(res.body as object).sort()).toEqual([
      'admin_contact',
      'admin_group',
      'authorized_groups',
      'default_max_qty',
      'low_stock_notify',
      'registration_last_day',
      'signers',
    ]);
  });

  it.each([
    [{ registration_last_day: 29 }, 'registration_last_day'],
    [{ registration_last_day: 2 }, 'registration_last_day'],
    [{ registration_last_day: '10' }, 'registration_last_day'],
    [{ default_max_qty: 0 }, 'default_max_qty'],
    [{ admin_group: '  ' }, 'admin_group'],
    [{ authorized_groups: ['IT'] }, 'authorized_groups'],
    [{ constructor: 'x' }, 'constructor'],
    [{ toString: 'x' }, 'toString'],
  ])('PUT %j → 400 CONFIG_INVALID field %s, không ghi', async (body, field) => {
    const before = await pool.query(
      'SELECT key, value FROM config ORDER BY key',
    );
    const res = await put(body).expect(400);
    expect(res.body).toMatchObject({ code: 'CONFIG_INVALID', field });
    const after = await pool.query(
      'SELECT key, value FROM config ORDER BY key',
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('PUT body thô {"__proto__":…} → 400 CONFIG_INVALID, không 500', async () => {
    const res = await put('{"__proto__": {"x": 1}}')
      .set('Content-Type', 'application/json')
      .expect(400);
    expect(res.body).toMatchObject({ code: 'CONFIG_INVALID' });
    const keys = await pool.query(
      "SELECT key FROM config WHERE key IN ('constructor', 'toString', '__proto__')",
    );
    expect(keys.rows).toEqual([]);
  });

  it('PUT hợp lệ một khóa + một khóa sai → 400, khóa hợp lệ cũng không ghi', async () => {
    await put({ default_max_qty: 30, registration_last_day: 29 }).expect(400);
    const res = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(res.body.default_max_qty).not.toBe(30);
  });

  it('PUT {signers: {preparer}} → merge: admin_group và các người ký khác giữ nguyên, audit config.updated before/after', async () => {
    await put({
      signers: { preparer: 'P0', head: 'Trưởng phòng', approver: 'GĐ' },
    }).expect(200);
    const res = await put({ signers: { preparer: 'A' } }).expect(200);
    expect(res.body.admin_group).toBe('vpp-admin');
    expect(res.body.signers).toEqual({
      preparer: 'A',
      head: 'Trưởng phòng',
      approver: 'GĐ',
    });
    const got = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(got.body.admin_group).toBe('vpp-admin');
    expect(got.body.signers.preparer).toBe('A');

    const audit = await pool.query(
      `SELECT actor, object_type, object_id, detail FROM audit_log
       WHERE action = 'config.updated' AND actor = $1
       ORDER BY created_at DESC LIMIT 1`,
      [ADMIN_SUB],
    );
    expect(audit.rows[0]).toMatchObject({
      object_type: 'config',
      object_id: 'signers',
      detail: {
        before: {
          signers: { preparer: 'P0', head: 'Trưởng phòng', approver: 'GĐ' },
        },
        after: {
          signers: { preparer: 'A', head: 'Trưởng phòng', approver: 'GĐ' },
        },
      },
    });
  });

  it('PUT registration_last_day=12 → GET trả số 12 (hiệu lực ngay, không chờ cache)', async () => {
    await put({ registration_last_day: 12 }).expect(200);
    const res = await asAdmin(
      request(app.getHttpServer()).get('/api/admin/config'),
    ).expect(200);
    expect(res.body.registration_last_day).toBe(12);
  });
});
