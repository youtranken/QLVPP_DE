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
const OWNERS = [`db-deliver-a-${SUFFIX}`, `db-deliver-b-${SUFFIX}`];
const ADMIN = `db-deliver-admin-${SUFFIX}`;
// Kỳ quá khứ đã khóa theo đồng hồ thật → không cần đứng đồng hồ
const YM = '2024-06-01';
const ROUNDS = 5;

describe('Giao song song (Postgres thật, hai request HTTP thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId: string;
  let createdPeriod = false;

  const deliver = (lineId: string, qty: number, expected: number) =>
    request(app.getHttpServer())
      .post(`/api/admin/lines/${lineId}/deliver`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', 'admin')
      .send({ qty, expected_delivered_qty: expected });
  const outcome = (r: request.Response) =>
    r.status === 200 ? '200' : `${r.status} ${r.body.code}`;
  const seedLine = async (owner: string, qty: number) => {
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2)
       RETURNING id`,
      [YM, owner],
    );
    return (
      await pool.query<{ id: string }>(
        'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, $3) RETURNING id',
        [req.rows[0].id, itemId, qty],
      )
    ).rows[0].id;
  };
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
  const movementCount = async () =>
    (
      await pool.query('SELECT 1 FROM stock_movements WHERE item_id = $1', [
        itemId,
      ])
    ).rows.length;

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
        "INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cay', 10) RETURNING id",
        [`db-deliver-${SUFFIX}`],
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
    // Chỉ xóa kỳ suite này tạo; bảng khác (bản chốt…) có thể đã trỏ tới kỳ → giữ lại thay vì làm hỏng afterAll
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

  it(`${ROUNDS} vòng hai POST deliver {qty 3, expected 0} cùng dòng → đúng một 200 + một 409 STALE_UPDATE, đúng 1 movement, tồn 7`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await reset(10);
      const line = await seedLine(OWNERS[0], 5);
      const results = await Promise.all([
        deliver(line, 3, 0),
        deliver(line, 3, 0),
      ]);
      expect(results.map(outcome).sort()).toEqual(['200', '409 STALE_UPDATE']);
      const stale = results.find((r) => r.status === 409)!;
      expect(stale.body.delivered_qty).toBe(3);
      expect(await movementCount()).toBe(1);
      expect(await stock()).toBe(7);
    }
  });

  it(`${ROUNDS} vòng hai dòng khác phiếu cùng món tồn 4, mỗi dòng giao 3 song song → một 200, một 409 STOCK_INSUFFICIENT {available: 1}, tồn 1`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await reset(4);
      const lines = [
        await seedLine(OWNERS[0], 3),
        await seedLine(OWNERS[1], 3),
      ];
      const results = await Promise.all(lines.map((l) => deliver(l, 3, 0)));
      expect(results.map(outcome).sort()).toEqual([
        '200',
        '409 STOCK_INSUFFICIENT',
      ]);
      expect(results.find((r) => r.status === 409)!.body.available).toBe(1);
      expect(await stock()).toBe(1);
      expect(await movementCount()).toBe(1);
    }
  });
});
