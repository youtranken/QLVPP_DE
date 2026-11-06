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
const OWNER = `db-sendadm-a-${SUFFIX}`;
const ADMINS = [`db-sendadm-x-${SUFFIX}`, `db-sendadm-y-${SUFFIX}`];
// Kỳ quá khứ đã khóa theo đồng hồ thật, không suite nào khác dùng
const YM = '2002-07';
const ROUNDS = 8;

describe('Gửi ADM: hai Hành chính cùng lúc "không cần đề nghị" và In trình ký (Postgres thật)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let itemId: string;

  const as = (req: request.Test, sub: string) =>
    req.set('x-dev-user-sub', sub).set('x-dev-role', 'admin');
  const noOrder = (sub: string) =>
    as(
      request(app.getHttpServer()).post(`/api/admin/periods/${YM}/no-order`),
      sub,
    ).send({ order_qty: { [itemId]: 0 } });
  const snapshot = (sub: string) =>
    as(
      request(app.getHttpServer()).post(`/api/admin/reports/${YM}/snapshots`),
      sub,
    ).send({ kind: 'print' });
  const outcome = (r: request.Response) =>
    r.status < 300 ? String(r.status) : `${r.status} ${r.body.code}`;
  const finalState = async () =>
    (
      await pool.query<{ snapshots: number; flagged: boolean }>(
        `SELECT (SELECT count(*)::int FROM report_snapshots s
                 WHERE s.period_ym = $1::date
                   AND EXISTS (SELECT 1 FROM jsonb_each_text(s.data->'order_qty') e WHERE e.value::int > 0)) AS snapshots,
                p.no_order_at IS NOT NULL AS flagged
         FROM periods p WHERE p.ym = $1::date`,
        [`${YM}-01`],
      )
    ).rows[0];
  const reset = () =>
    Promise.all([
      pool.query('DELETE FROM report_snapshots WHERE period_ym = $1::date', [
        `${YM}-01`,
      ]),
      pool.query(
        'UPDATE periods SET no_order_at = NULL, no_order_by = NULL WHERE ym = $1::date',
        [`${YM}-01`],
      ),
    ]);

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      `INSERT INTO users (sub, full_name, status) VALUES ($1, 'A', 'active'), ($2, 'X', 'active'), ($3, 'Y', 'active')`,
      [OWNER, ...ADMINS],
    );
    await pool.query(
      `INSERT INTO periods (ym, deadline) VALUES ($1::date, '2002-07-10T17:00:00Z') ON CONFLICT (ym) DO NOTHING`,
      [`${YM}-01`],
    );
    itemId = (
      await pool.query<{ id: string }>(
        `INSERT INTO items (name, unit, max_qty) VALUES ($1, 'cai', 5) RETURNING id`,
        [`db-sendadm-item-${SUFFIX}`],
      )
    ).rows[0].id;
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ($1::date, $2, $2) RETURNING id`,
      [`${YM}-01`, OWNER],
    );
    await pool.query(
      'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 3)',
      [req.rows[0].id, itemId],
    );
    process.env.AUTH_DEV_MODE = 'true';
    process.env.NODE_ENV = 'test';
    app = (await createTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
    await reset();
    await pool.query('DELETE FROM requests WHERE user_sub = $1', [OWNER]);
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
    await pool.query('DELETE FROM periods WHERE ym = $1::date', [`${YM}-01`]);
    await pool.query('DELETE FROM users WHERE sub = ANY($1)', [
      [OWNER, ...ADMINS],
    ]);
    await pool.end();
  });

  beforeEach(reset);

  it('Promise.all(no-order, snapshot) × 8 lượt: In trình ký luôn 201, kỳ không bao giờ vừa có bản vừa có cờ', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await reset();
      const [a, b] = i % 2 ? ADMINS : [...ADMINS].reverse();
      const [flag, snap] =
        i % 2
          ? await Promise.all([noOrder(a), snapshot(b)])
          : await Promise.all([snapshot(b), noOrder(a)]).then(
              ([s, n]) => [n, s] as const,
            );
      expect(outcome(snap)).toBe('201');
      expect(['200', '409 ALREADY_SENT']).toContain(outcome(flag));
      expect(await finalState()).toEqual({ snapshots: 1, flagged: false });
    }
  });

  it('cờ có trước rồi mới In: bản tạo được, cờ tự xóa (audit period.no_order_cleared); no-order sau đó → 409 ALREADY_SENT', async () => {
    expect(outcome(await noOrder(ADMINS[0]))).toBe('200');
    expect(await finalState()).toEqual({ snapshots: 0, flagged: true });
    expect(outcome(await snapshot(ADMINS[1]))).toBe('201');
    expect(await finalState()).toEqual({ snapshots: 1, flagged: false });
    expect(outcome(await noOrder(ADMINS[0]))).toBe('409 ALREADY_SENT');
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log
       WHERE action = 'period.no_order_cleared' AND object_id = $1 AND actor = $2`,
      [YM, ADMINS[1]],
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('hai no-order cùng lúc → cả hai 200, một audit period.no_order', async () => {
    const before = (
      await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'period.no_order' AND object_id = $1`,
        [YM],
      )
    ).rows[0].n;
    const results = await Promise.all(ADMINS.map((s) => noOrder(s)));
    expect(results.map(outcome)).toEqual(['200', '200']);
    expect(results[0].body.no_order_at).toBe(results[1].body.no_order_at);
    const after = (
      await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'period.no_order' AND object_id = $1`,
        [YM],
      )
    ).rows[0].n;
    expect(after).toBe(before + 1);
  });
});
