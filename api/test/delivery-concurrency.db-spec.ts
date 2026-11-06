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
  // items[0] < items[1] theo id: thứ tự Postgres khóa món khi khóa theo id
  let items: string[];
  let itemId: string;
  let createdPeriod = false;

  const deliver = (lineId: string, qty: number, expected: number) =>
    request(app.getHttpServer())
      .post(`/api/admin/lines/${lineId}/deliver`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', 'admin')
      .send({ qty, expected_delivered_qty: expected });
  const cancel = (lineId: string, expected: number) =>
    request(app.getHttpServer())
      .post(`/api/admin/lines/${lineId}/cancel-remaining`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', 'admin')
      .send({
        reason_code: 'not_needed',
        expected_delivered_qty: expected,
        expected_qty: 5,
      });
  const outcome = (r: request.Response) =>
    r.status === 200 ? '200' : `${r.status} ${r.body.code}`;
  const seedRequest = async (
    owner: string,
    lines: { id?: string; item: string; qty: number }[],
  ) => {
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2)
       RETURNING id`,
      [YM, owner],
    );
    const lineIds: string[] = [];
    for (const l of lines) {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO request_lines (id, request_id, item_id, qty)
         VALUES (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4) RETURNING id`,
        [l.id ?? null, req.rows[0].id, l.item, l.qty],
      );
      lineIds.push(rows[0].id);
    }
    return { requestId: req.rows[0].id, lineIds };
  };
  const seedLine = async (owner: string, qty: number) =>
    (await seedRequest(owner, [{ item: itemId, qty }])).lineIds[0];
  const reset = async (stock: number) => {
    await pool.query(
      `DELETE FROM line_deliveries WHERE line_id IN (
         SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id
         WHERE r.user_sub = ANY($1))`,
      [OWNERS],
    );
    await pool.query('DELETE FROM stock_movements WHERE item_id = ANY($1)', [
      items,
    ]);
    await pool.query(
      'DELETE FROM in_app_notifications WHERE user_sub = ANY($1)',
      [OWNERS],
    );
    await pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [OWNERS]);
    await pool.query('UPDATE items SET stock_qty = $2 WHERE id = ANY($1)', [
      items,
      stock,
    ]);
  };
  const stock = async (id = itemId) =>
    (
      await pool.query<{ stock_qty: number }>(
        'SELECT stock_qty FROM items WHERE id = $1',
        [id],
      )
    ).rows[0].stock_qty;
  const movementCount = async () =>
    (
      await pool.query(
        'SELECT 1 FROM stock_movements WHERE item_id = ANY($1)',
        [items],
      )
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
    items = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty)
         SELECT $1 || n, 'cay', 10 FROM generate_series(1, 2) AS n RETURNING id`,
        [`db-deliver-${SUFFIX}-`],
      )
    ).rows
      .map((r) => r.id)
      .sort();
    itemId = items[0];
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await reset(0);
    await pool.query('DELETE FROM items WHERE id = ANY($1)', [items]);
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

  it(`${ROUNDS} vòng hủy nợ và giao 2 song song cùng dòng qty 5 (expected 0) → một 200 + một 409 STALE_UPDATE hoặc 400 DELIVER_EXCEEDS_QTY {remaining: 0}; delivered + cancelled = 5 hoặc 2 + 0, không vượt qty`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await reset(10);
      const line = await seedLine(OWNERS[0], 5);
      const [delivered, cancelled] = await Promise.all([
        deliver(line, 2, 0),
        cancel(line, 0),
      ]);
      const { rows } = await pool.query<{ d: number; c: number }>(
        'SELECT delivered_qty AS d, cancelled_qty AS c FROM request_lines WHERE id = $1',
        [line],
      );
      const pair = `${outcome(delivered)} | ${outcome(cancelled)}`;
      if (delivered.status === 200) {
        expect(pair).toBe('200 | 409 STALE_UPDATE');
        expect(rows[0]).toEqual({ d: 2, c: 0 });
        expect(await stock()).toBe(8);
      } else {
        expect(pair).toBe('400 DELIVER_EXCEEDS_QTY | 200');
        expect(delivered.body.remaining).toBe(0);
        expect(rows[0]).toEqual({ d: 0, c: 5 });
        expect(await stock()).toBe(10);
      }
      expect(rows[0].d + rows[0].c).toBeLessThanOrEqual(5);
    }
  });
});
