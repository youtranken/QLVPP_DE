import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { StockService } from '../src/modules/catalog/stock.service';
import { PeriodsService } from '../src/modules/periods/periods.service';
import { RequestLinesWriter } from '../src/modules/requests/request-lines.writer';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
const OWNER = `db-lock-owner-${SUFFIX}`;
const MEMBER = `db-lock-member-${SUFFIX}`;
const ADMIN = `db-lock-admin-${SUFFIX}`;
const LOCKED_YM = '2024-06-01';
const ROUNDS = 3;

type Settled = PromiseSettledResult<unknown>;

// Một giao dịch thứ ba giữ món giữa để ép hai bên xen kẽ đúng thứ tự gây deadlock, không phụ thuộc may rủi
describe('Thứ tự khóa items: deliver-all không deadlock với lưu phiếu và cron sắp hết (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let db: Database;
  let created: string[] = [];
  let createdPeriod = false;

  const deliverAll = (requestId: string) =>
    request(app.getHttpServer())
      .post(`/api/admin/requests/${requestId}/deliver-all`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', 'admin');

  const newItems = async (n: number, stock: number, restock: number | null) => {
    const ids = Array.from({ length: n }, () => randomUUID()).sort();
    // Chèn theo id giảm dần: seq scan của cron gặp món id lớn trước
    for (const id of [...ids].reverse()) {
      await pool.query(
        `INSERT INTO items (id, name, unit, max_qty, stock_qty, restock_level)
         VALUES ($1, $2, 'cai', 10, $3, $4)`,
        [id, `db-lock-${SUFFIX}-${id}`, stock, restock],
      );
    }
    created.push(...ids);
    return ids;
  };

  const lockedRequest = async (itemIds: string[]) => {
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2) RETURNING id`,
      [LOCKED_YM, OWNER],
    );
    for (const item of itemIds) {
      await pool.query(
        `INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 1)`,
        [req.rows[0].id, item],
      );
    }
    return req.rows[0].id;
  };

  const lockWaiters = async () =>
    Number(
      (
        await pool.query<{ n: string }>(
          `SELECT count(*) AS n FROM pg_stat_activity
           WHERE datname = current_database() AND wait_event_type = 'Lock'`,
        )
      ).rows[0].n,
    );

  // Chờ tới khi có n tiến trình đứng chờ khóa, hoặc promise đã xong (bản sửa: không ai phải chờ)
  const waitFor = async (n: number, pending: Promise<unknown>) => {
    let done = false;
    void pending.then(
      () => (done = true),
      () => (done = true),
    );
    for (let i = 0; i < 250 && !done; i++) {
      if ((await lockWaiters()) >= n) return;
      await new Promise((r) => setTimeout(r, 20));
    }
  };

  const holdRow = async (itemId: string): Promise<PoolClient> => {
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT id FROM items WHERE id = $1 FOR NO KEY UPDATE', [
      itemId,
    ]);
    return client;
  };

  const release = async (client: PoolClient) => {
    await client.query('COMMIT');
    client.release();
  };

  const describeOutcome = (s: Settled) => {
    if (s.status === 'rejected') {
      const e = s.reason as { code?: string; cause?: { code?: string } };
      return `rejected ${e.cause?.code ?? e.code ?? String(s.reason)}`;
    }
    const v = s.value as { status?: number; body?: { code?: string } };
    return v.status === undefined || v.status === 200
      ? 'ok'
      : `${v.status} ${v.body?.code}`;
  };

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url, max: 6 });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    createdPeriod =
      (
        await pool.query(
          `INSERT INTO periods (ym, deadline) VALUES ($1, '2024-06-10T17:00:00Z')
           ON CONFLICT (ym) DO NOTHING`,
          [LOCKED_YM],
        )
      ).rowCount === 1;
    await pool.query(
      `INSERT INTO users (sub, department, status)
       SELECT s, 'Phòng CT', 'active' FROM unnest($1::text[]) AS s`,
      [[OWNER, MEMBER]],
    );
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp()) as INestApplication<App>;
    db = app.get<Database>(DRIZZLE_DB);
  });

  const cleanRound = async () => {
    await pool.query(
      'DELETE FROM in_app_notifications WHERE user_sub = ANY($1)',
      [[OWNER, MEMBER]],
    );
    await pool.query(
      `DELETE FROM line_deliveries WHERE line_id IN (
         SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id
         WHERE r.user_sub = ANY($1))`,
      [[OWNER, MEMBER]],
    );
    await pool.query('DELETE FROM stock_movements WHERE item_id = ANY($1)', [
      created,
    ]);
    await pool.query('DELETE FROM requests WHERE user_sub = ANY($1)', [
      [OWNER, MEMBER],
    ]);
    await pool.query('DELETE FROM items WHERE id = ANY($1)', [created]);
    created = [];
  };

  afterEach(cleanRound);

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [
      [OWNER, MEMBER],
    ]);
    if (createdPeriod) {
      await pool
        .query(
          'DELETE FROM periods WHERE ym = $1 AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = $1)',
          [LOCKED_YM],
        )
        .catch(() => undefined);
    }
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it(`${ROUNDS} vòng deliver-all (món X < Y) song song member lưu phiếu kỳ mới chèn dòng Y rồi X → không 40P01, cả hai thành công`, async () => {
    const writer = app.get(RequestLinesWriter);
    for (let round = 0; round < ROUNDS; round++) {
      const [x, y] = await newItems(2, 10, null);
      const requestId = await lockedRequest([x, y]);
      const now = new Date();
      const { ym } = await app.get(PeriodsService).openPeriod(db, now);
      const holder = await holdRow(y);
      const delivering = deliverAll(requestId).then((r) => r);
      await waitFor(1, delivering);
      const saving = db.transaction((tx) =>
        writer.save(tx, {
          owner_sub: MEMBER,
          period_ym: ym,
          actor: { sub: MEMBER, role: 'member', devMode: true },
          body: {
            lines: [
              { item_id: y, qty: 1 },
              { item_id: x, qty: 1 },
            ],
          },
          now,
        }),
      );
      await waitFor(2, saving);
      await release(holder);
      const results = await Promise.allSettled([delivering, saving]);
      expect(results.map(describeOutcome)).toEqual(['ok', 'ok']);
      const delivered = (results[0] as PromiseFulfilledResult<request.Response>)
        .value.body as { delivered: unknown[] };
      expect(delivered.delivered).toHaveLength(2);
      await cleanRound();
    }
  });

  it(`${ROUNDS} vòng claimLowStockWithin (3 món sắp hết, seq scan gặp id lớn trước) song song deliver-all cùng 3 món → không 40P01, cron đòi đủ 3 món`, async () => {
    const stock = app.get(StockService);
    for (let round = 0; round < ROUNDS; round++) {
      const [x, m, y] = await newItems(3, 2, 10);
      const order = await pool.query<{ id: string }>(
        'SELECT id FROM items WHERE id = ANY($1) ORDER BY ctid',
        [[x, m, y]],
      );
      expect(order.rows.map((r) => r.id)).toEqual([y, m, x]);
      const requestId = await lockedRequest([x, m, y]);
      const holder = await holdRow(m);
      const delivering = deliverAll(requestId).then((r) => r);
      await waitFor(1, delivering);
      const claiming = db.transaction((tx) =>
        stock.claimLowStockWithin(tx, new Date()),
      );
      await waitFor(2, claiming);
      await release(holder);
      const results = await Promise.allSettled([delivering, claiming]);
      expect(results.map(describeOutcome)).toEqual(['ok', 'ok']);
      const claimed = (
        results[1] as PromiseFulfilledResult<{ id: string }[]>
      ).value.map((c) => c.id);
      expect(claimed).toEqual(expect.arrayContaining([x, m, y]));
      await cleanRound();
    }
  });
});
