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
const RUN = `${process.pid}-${Date.now().toString(36)}`;
const ACTOR = `e2e-label-${RUN}`;
const OWNER = `e2e-label-owner-${RUN}`;
const YM = '2001-04-01';
const GONE_ID = '00000000-0000-4000-8000-00000000dead';

interface Row {
  objectType: string;
  objectId: string;
  objectLabel: {
    name: string | null;
    ym: string | null;
    owner: string | null;
  } | null;
}

describe('GET admin/audit: objectLabel tên người đọc được cho cột Đối tượng', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  const ids: Record<string, string> = {};

  const one = async (sql: string, params: unknown[]) =>
    (await pool.query<{ id: string }>(sql, params)).rows[0].id;
  const audit = (objectType: string, objectId: string) =>
    pool.query(
      'INSERT INTO audit_log (actor, action, object_type, object_id) VALUES ($1, $2, $3, $4)',
      [ACTOR, `e2e.${objectType}`, objectType, objectId],
    );
  const list = async () =>
    (
      (
        await request(app.getHttpServer())
          .get('/api/admin/audit')
          .query({ actor: ACTOR, limit: 50 })
          .set('x-dev-user-sub', 'dev-admin')
          .set('x-dev-role', 'admin')
          .expect(200)
      ).body as { items: Row[] }
    ).items;
  const labelOf = (rows: Row[], type: string, id: string) =>
    rows.find((r) => r.objectType === type && r.objectId === id)?.objectLabel;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    await pool.query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Chủ Phiếu Thử', 'Phòng CT', 'active')`,
      [OWNER],
    );
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ($1, '2001-04-10T17:00:00Z') ON CONFLICT (ym) DO NOTHING`,
      [YM],
    );
    ids.category = await one(
      'INSERT INTO item_categories (name) VALUES ($1) RETURNING id',
      [`Nhóm thử ${RUN}`],
    );
    ids.item = await one(
      `INSERT INTO items (name, unit, category_id) VALUES ($1, 'cai', $2) RETURNING id`,
      [`Bút thử ${RUN}`, ids.category],
    );
    ids.request = await one(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2) RETURNING id`,
      [YM, OWNER],
    );
    ids.line = await one(
      'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 2) RETURNING id',
      [ids.request, ids.item],
    );
    await audit('item', ids.item);
    await audit('item_category', ids.category);
    await audit('unit', 'cai');
    await audit('request', ids.request);
    await audit('request_line', ids.line);
    await audit('user', OWNER);
    await audit('period', '2001-04');
    await audit('item', GONE_ID);
    await audit('session', GONE_ID);
    await audit('item', 'không-phải-uuid');
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    await pool.query('DELETE FROM items WHERE id = $1', [ids.item]);
    await pool.query('DELETE FROM item_categories WHERE id = $1', [
      ids.category,
    ]);
    await pool.query(
      'DELETE FROM periods p WHERE ym = $1 AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)',
      [YM],
    );
    await pool.query('DELETE FROM users WHERE sub = $1', [OWNER]);
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('món, nhóm, ĐVT, người → tên; phiếu → tháng + chủ phiếu; dòng phiếu → tên món + tháng + chủ phiếu; kỳ → tháng', async () => {
    const rows = await list();
    expect(labelOf(rows, 'item', ids.item)).toEqual({
      name: `Bút thử ${RUN}`,
      ym: null,
      owner: null,
    });
    expect(labelOf(rows, 'item_category', ids.category)).toEqual({
      name: `Nhóm thử ${RUN}`,
      ym: null,
      owner: null,
    });
    expect(labelOf(rows, 'unit', 'cai')?.name).toEqual(expect.any(String));
    expect(labelOf(rows, 'user', OWNER)).toEqual({
      name: 'Chủ Phiếu Thử',
      ym: null,
      owner: null,
    });
    expect(labelOf(rows, 'request', ids.request)).toEqual({
      name: null,
      ym: '2001-04',
      owner: 'Chủ Phiếu Thử',
    });
    expect(labelOf(rows, 'request_line', ids.line)).toEqual({
      name: `Bút thử ${RUN}`,
      ym: '2001-04',
      owner: 'Chủ Phiếu Thử',
    });
    expect(labelOf(rows, 'period', '2001-04')).toEqual({
      name: null,
      ym: '2001-04',
      owner: null,
    });
  });

  it('đối tượng không còn, loại không tra được hoặc id không phải uuid → objectLabel null (FE hiện id ngắn)', async () => {
    const rows = await list();
    expect(labelOf(rows, 'item', GONE_ID)).toBeNull();
    expect(labelOf(rows, 'session', GONE_ID)).toBeNull();
    expect(labelOf(rows, 'item', 'không-phải-uuid')).toBeNull();
  });

  it('món đã xóa sau khi ghi nhật ký → objectLabel null', async () => {
    const goneItem = await one(
      `INSERT INTO items (name, unit) VALUES ($1, 'cai') RETURNING id`,
      [`Món sẽ xóa ${RUN}`],
    );
    await audit('item', goneItem);
    await pool.query('DELETE FROM items WHERE id = $1', [goneItem]);
    expect(labelOf(await list(), 'item', goneItem)).toBeNull();
  });
});
