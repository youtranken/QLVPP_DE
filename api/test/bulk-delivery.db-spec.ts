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
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
const OWNERS = [`db-bulk-a-${SUFFIX}`, `db-bulk-b-${SUFFIX}`];
const ADMIN = `db-bulk-admin-${SUFFIX}`;
const YM = '2024-06-01'; // kỳ quá khứ: luôn khóa theo đồng hồ thật
const ROUNDS = 5;

describe('Giao nhiều phiếu song song (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId: string;
  let createdPeriod = false;

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', 'admin')
      .send(body);
  const bulk = (body: object) => post('/api/admin/deliveries/bulk', body);
  const single = (lineId: string, qty: number) =>
    post(`/api/admin/lines/${lineId}/deliver`, {
      qty,
      expected_delivered_qty: 0,
    });
  const seed = async (owner: string, qty: number) => {
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2) RETURNING id`,
      [YM, owner],
    );
    const line = await pool.query<{ id: string }>(
      `INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, $3) RETURNING id`,
      [req.rows[0].id, itemId, qty],
    );
    return { requestId: req.rows[0].id, lineId: line.rows[0].id };
  };
  const body = (
    ...rows: { requestId: string; lineId: string; qty: number }[]
  ) => ({
    requests: rows.map((r) => ({
      request_id: r.requestId,
      lines: [{ line_id: r.lineId, qty: r.qty, expected_delivered_qty: 0 }],
    })),
  });
  const reset = async (stock: number) => {
    await pool.query(
      `DELETE FROM line_deliveries WHERE line_id IN (
         SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id
         WHERE r.user_sub = ANY($1))`,
      [OWNERS],
    );
    await pool.query('DELETE FROM stock_movements WHERE item_id = $1', [
      itemId,
    ]);
    await pool.query(
      'DELETE FROM in_app_notifications WHERE user_sub = ANY($1)',
      [OWNERS],
    );
    await pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [OWNERS]);
    await pool.query('UPDATE items SET stock_qty = $2 WHERE id = $1', [
      itemId,
      stock,
    ]);
  };
  const stock = async () =>
    (
      await pool.query<{ stock_qty: number }>(
        'SELECT stock_qty FROM items WHERE id = $1',
        [itemId],
      )
    ).rows[0].stock_qty;
  const deliveryCount = async () =>
    (
      await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM line_deliveries d JOIN request_lines l ON l.id = d.line_id
         JOIN requests r ON r.id = l.request_id WHERE r.user_sub = ANY($1)`,
        [OWNERS],
      )
    ).rows[0].n;

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    createdPeriod =
      (
        await pool.query(
          `INSERT INTO periods (ym, deadline) VALUES ($1, '2024-06-10T17:00:00Z')
           ON CONFLICT (ym) DO NOTHING`,
          [YM],
        )
      ).rowCount === 1;
    await pool.query(
      `INSERT INTO users (sub, status) SELECT s, 'active' FROM unnest($1::text[]) AS s`,
      [OWNERS],
    );
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 10) RETURNING id`,
        [`db-bulk-${SUFFIX}`],
      )
    ).rows[0].id;
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await reset(0);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [OWNERS]);
    if (createdPeriod) {
      await pool
        .query(
          'DELETE FROM periods WHERE ym = $1 AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = $1)',
          [YM],
        )
        .catch(() => undefined);
    }
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it(`${ROUNDS} vòng hai bulk giống hệt nhau cùng lúc → đúng một bộ line_deliveries, một ok + một STALE_UPDATE mỗi phiếu`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await reset(10);
      const a = await seed(OWNERS[0], 2);
      const c = await seed(OWNERS[1], 4);
      const same = body({ ...a, qty: 2 }, { ...c, qty: 3 });
      const [r1, r2] = await Promise.all([bulk(same), bulk(same)]);
      const flat = [r1, r2].flatMap(
        (r) =>
          (r.body as { results: { ok: boolean; code?: string }[] }).results,
      );
      expect(flat.filter((r) => r.ok)).toHaveLength(2);
      expect(flat.filter((r) => r.code === 'STALE_UPDATE')).toHaveLength(2);
      expect(await deliveryCount()).toBe(2);
      expect(await stock()).toBe(5);
    }
  });

  it(`${ROUNDS} vòng bulk (A, C) song song giao đơn cùng món → không deadlock trong 5 s, tồn không âm`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await reset(5);
      const a = await seed(OWNERS[0], 3);
      const c = await seed(OWNERS[1], 3);
      const started = Date.now();
      const results = await Promise.all([
        bulk(body({ ...a, qty: 3 }, { ...c, qty: 2 })),
        single(c.lineId, 3),
      ]);
      expect(Date.now() - started).toBeLessThan(5000);
      expect(results[0].status).toBe(200);
      expect([200, 409]).toContain(results[1].status);
      expect(await stock()).toBeGreaterThanOrEqual(0);
    }
  });
});
