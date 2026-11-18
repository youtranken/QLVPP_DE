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
const OWNER = `db-cnlreq-owner-${SUFFIX}`;
const ADMIN = `db-cnlreq-admin-${SUFFIX}`;
// Kỳ quá khứ đã khóa theo đồng hồ thật → không cần đứng đồng hồ
const YM = '2024-07-01';
const ROUNDS = 5;

describe('Hủy phiếu người đã nghỉ song song (Postgres thật, hai request HTTP thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let items: string[];
  let createdPeriod = false;

  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', 'admin')
      .send(body);
  const outcome = (r: request.Response) =>
    r.status === 200 ? '200' : `${r.status} ${r.body.code}`;
  const reset = async () => {
    await pool.query(
      `DELETE FROM line_deliveries WHERE line_id IN (
         SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub = $1)`,
      [OWNER],
    );
    await pool.query('DELETE FROM stock_movements WHERE item_id = ANY($1)', [
      items,
    ]);
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    await pool.query('UPDATE items SET stock_qty = 10 WHERE id = ANY($1)', [
      items,
    ]);
  };
  const seedRequest = async () => {
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2) RETURNING id`,
      [YM, OWNER],
    );
    const lines = await pool.query<{ id: string }>(
      `INSERT INTO request_lines (request_id, item_id, qty)
       SELECT $1, unnest($2::uuid[]), unnest(ARRAY[3, 4]) RETURNING id`,
      [req.rows[0].id, items],
    );
    return { requestId: req.rows[0].id, lineIds: lines.rows.map((r) => r.id) };
  };
  const linesOf = async (requestId: string) =>
    (
      await pool.query<{ d: number; c: number; qty: number }>(
        'SELECT qty, delivered_qty AS d, cancelled_qty AS c FROM request_lines WHERE request_id = $1 ORDER BY qty',
        [requestId],
      )
    ).rows;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    createdPeriod =
      (
        await pool.query(
          `INSERT INTO periods (ym, deadline) VALUES ($1, '2024-07-10T17:00:00Z')
           ON CONFLICT (ym) DO NOTHING`,
          [YM],
        )
      ).rowCount === 1;
    await pool.query(
      "INSERT INTO users (sub, status) VALUES ($1, 'locked'), ($2, 'active')",
      [OWNER, ADMIN],
    );
    items = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty)
         SELECT $1 || n, 'cay', 10 FROM generate_series(1, 2) AS n RETURNING id`,
        [`db-cnlreq-${SUFFIX}-`],
      )
    ).rows.map((r) => r.id);
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await reset();
    await pool.query('DELETE FROM undo_actions WHERE actor_sub = $1', [ADMIN]);
    await pool.query('DELETE FROM items WHERE id = ANY($1)', [items]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [[OWNER, ADMIN]]);
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

  it(`${ROUNDS} vòng hai POST hủy cả phiếu cùng lúc → đúng một lần hủy 7, lần kia 200 cancelled_now 0; cancelled = qty, một audit cha`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await reset();
      const { requestId, lineIds } = await seedRequest();
      const body = {
        expected_lines: lineIds.map((id, k) => ({
          line_id: id,
          remaining: k === 0 ? 3 : 4,
        })),
      };
      const path = `/api/admin/requests/${requestId}/cancel-remaining`;
      const results = await Promise.all([post(path, body), post(path, body)]);
      expect(results.map(outcome)).toEqual(['200', '200']);
      expect(
        results
          .map((r) => (r.body as { cancelled_now: number }).cancelled_now)
          .sort(),
      ).toEqual([0, 7]);
      expect(await linesOf(requestId)).toEqual([
        { qty: 3, d: 0, c: 3 },
        { qty: 4, d: 0, c: 4 },
      ]);
      const audits = await pool.query(
        "SELECT 1 FROM audit_log WHERE action = 'request.cancel_remaining' AND object_id = $1",
        [requestId],
      );
      expect(audits.rows).toHaveLength(1);
    }
  });

  it(`${ROUNDS} vòng hủy cả phiếu song song với giao 2 dòng đầu → một bên thắng, bên kia 409 STALE_UPDATE hoặc 400 DELIVER_EXCEEDS_QTY; không dòng nào delivered + cancelled > qty`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await reset();
      const { requestId, lineIds } = await seedRequest();
      const [delivered, cancelled] = await Promise.all([
        post(`/api/admin/lines/${lineIds[0]}/deliver`, {
          qty: 2,
          expected_delivered_qty: 0,
        }),
        post(`/api/admin/requests/${requestId}/cancel-remaining`, {
          expected_lines: lineIds.map((id, k) => ({
            line_id: id,
            remaining: k === 0 ? 3 : 4,
          })),
        }),
      ]);
      const pair = `${outcome(delivered)} | ${outcome(cancelled)}`;
      const rows = await linesOf(requestId);
      if (delivered.status === 200) {
        expect(pair).toBe('200 | 409 STALE_UPDATE');
        expect(rows).toEqual([
          { qty: 3, d: 2, c: 0 },
          { qty: 4, d: 0, c: 0 },
        ]);
      } else {
        expect(pair).toBe('400 DELIVER_EXCEEDS_QTY | 200');
        expect(rows).toEqual([
          { qty: 3, d: 0, c: 3 },
          { qty: 4, d: 0, c: 4 },
        ]);
      }
    }
  });
});
