import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClockService } from '../src/common/clock.service';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { createTestApp } from './test-app.helper';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
const OWNER = `db-admcancel-owner-${SUFFIX}`;
const ADMIN = `db-admcancel-admin-${SUFFIX}`;
// Kỳ riêng: không suite nào khác có phiếu 2003; tháng đang giao = 2003-06 lúc 20/06
const YM = '2003-06-01';
const NEXT = '2003-07-01';
const NOW = '2003-06-20T03:00:00.000Z';

// Một giao dịch giữ dòng đánh dấu như AdmOutService.unmark rồi xóa: hủy "ADM hết hàng" phải chờ và đọc lại sau khi bỏ dấu
describe('Hủy phần còn lại "ADM hết hàng" khóa dòng đánh dấu trước khi đọc (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let item: string;
  let line: string;

  const lockWaiters = async () =>
    Number(
      (
        await pool.query<{ n: string }>(
          `SELECT count(*) AS n FROM pg_stat_activity
           WHERE datname = current_database() AND wait_event_type = 'Lock'`,
        )
      ).rows[0].n,
    );

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

  const cancelAdmOut = () =>
    request(app.getHttpServer())
      .post(`/api/admin/lines/${line}/cancel-remaining`)
      .set('x-dev-user-sub', ADMIN)
      .set('x-dev-role', 'admin')
      .send({
        reason_code: 'adm_out_of_stock',
        expected_delivered_qty: 0,
        expected_qty: 2,
      })
      .then((r) => r);

  const unmarkHeld = async (): Promise<PoolClient> => {
    const client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `SELECT 1 FROM period_adm_out WHERE period_ym = $1 AND line_key = $2 AND kind = 'out' FOR UPDATE`,
      [YM, item],
    );
    await client.query(
      `DELETE FROM period_adm_out WHERE period_ym = $1 AND line_key = $2 AND kind = 'out'`,
      [YM, item],
    );
    return client;
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
      max: 6,
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ($1::date, $1::date + interval '9 days 17 hours'),
         ($2::date, $2::date + interval '9 days 17 hours') ON CONFLICT (ym) DO NOTHING`,
      [YM, NEXT],
    );
    await pool.query(
      `INSERT INTO users (sub, department, status) VALUES ($1, 'Phòng CT', 'active')`,
      [OWNER],
    );
    process.env.AUTH_DEV_MODE = 'true';
    app = (await createTestApp(
      [],
      [{ token: ClockService, useValue: { now: () => new Date(NOW) } }],
    )) as INestApplication<App>;
  });

  beforeEach(async () => {
    item = randomUUID();
    await pool.query(
      `INSERT INTO items (id, name, unit, max_qty, stock_qty) VALUES ($1, $2, 'cai', 10, 0)`,
      [item, `db-admcancel-${SUFFIX}-${item}`],
    );
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1, $2, $2) RETURNING id`,
      [YM, OWNER],
    );
    line = (
      await pool.query<{ id: string }>(
        `INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 2) RETURNING id`,
        [req.rows[0].id, item],
      )
    ).rows[0].id;
    await pool.query(
      `INSERT INTO period_adm_out (period_ym, line_key, kind, marked_by, marked_at)
       VALUES ($1, $2, 'out', $3, $4)`,
      [YM, item, ADMIN, NOW],
    );
  });

  afterEach(async () => {
    await pool.query('DELETE FROM in_app_notifications WHERE user_sub = $1', [
      OWNER,
    ]);
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    await pool.query('DELETE FROM period_adm_out WHERE period_ym = $1', [YM]);
    await pool.query('DELETE FROM items WHERE id = $1', [item]);
  });

  afterAll(async () => {
    await app.close();
    await pool.query('DELETE FROM users WHERE sub = $1', [OWNER]);
    await pool.query(
      'DELETE FROM periods WHERE ym = ANY($1::date[]) AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = periods.ym)',
      [[YM, NEXT]],
    );
    await pool.end();
    delete process.env.AUTH_DEV_MODE;
  });

  it('bỏ đánh dấu đang giữ dòng period_adm_out → hủy chờ khóa; bỏ dấu commit xong → 409 ITEM_NOT_ADM_OUT, dòng không bị hủy', async () => {
    const holder = await unmarkHeld();
    const cancelling = cancelAdmOut();
    await waitFor(1, cancelling);
    await holder.query('COMMIT');
    holder.release();
    const res = await cancelling;
    expect([res.status, (res.body as { code?: string }).code]).toEqual([
      409,
      'ITEM_NOT_ADM_OUT',
    ]);
    const { rows } = await pool.query<{ cancelled_qty: number }>(
      'SELECT cancelled_qty FROM request_lines WHERE id = $1',
      [line],
    );
    expect(rows[0].cancelled_qty).toBe(0);
  });

  it('không ai giữ dấu → hủy 200, cancelled_qty 2', async () => {
    const res = await cancelAdmOut();
    expect(res.status).toBe(200);
    expect((res.body as { cancelled_now: number }).cancelled_now).toBe(2);
  });
});
