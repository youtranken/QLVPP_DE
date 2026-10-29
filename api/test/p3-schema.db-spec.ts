import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('0103–0107 — kỳ ngày 1, event_id chuỗi, đợt giao, bản chốt, bỏ min_stock', () => {
  let pool: Pool;
  let lineId: string;
  let itemId: string;

  async function code(sql: string, params: unknown[] = []): Promise<string> {
    try {
      await pool.query(sql, params);
    } catch (e) {
      return (e as { code: string }).code;
    }
    return 'OK';
  }

  async function violation(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ code: string; constraint?: string }> {
    try {
      await pool.query(sql, params);
    } catch (e) {
      return e as { code: string; constraint?: string };
    }
    return { code: 'OK' };
  }

  async function newLine(sub: string): Promise<string> {
    await pool.query('INSERT INTO users (sub) VALUES ($1)', [sub]);
    const req = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ('2026-11-01', $1, $1) RETURNING id`,
      [sub],
    );
    const line = await pool.query<{ id: string }>(
      `INSERT INTO request_lines (request_id, item_id, qty)
       VALUES ($1, $2, 3) RETURNING id`,
      [req.rows[0].id, itemId],
    );
    return line.rows[0].id;
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString: assertTestDatabase(process.env.DATABASE_URL),
    });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      "INSERT INTO periods (ym, deadline) VALUES ('2026-11-01', '2026-11-11T00:00:00+07')",
    );
    const item = await pool.query<{ id: string }>(
      "INSERT INTO items (name, unit) VALUES ('Giấy p3', 'ram') RETURNING id",
    );
    itemId = item.rows[0].id;
    lineId = await newLine('p3-u1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('periods.ym phải là ngày 1: 2026-11-01 nhận, 2026-11-02 bị từ chối 23514', async () => {
    const ins = (ym: string) =>
      code(
        "INSERT INTO periods (ym, deadline) VALUES ($1, '2026-12-11T00:00:00+07')",
        [ym],
      );
    expect(await ins('2026-12-02')).toBe('23514');
    expect(await ins('2026-12-01')).toBe('OK');
  });

  it('periods.ym ngày 31 bị từ chối 23514', async () => {
    expect(
      await code(
        "INSERT INTO periods (ym, deadline) VALUES ('2027-01-31', now())",
      ),
    ).toBe('23514');
  });

  describe('in_app_notifications.event_id là chuỗi bắt buộc', () => {
    const ins = (event: string | null, sub = 'p3-u1') =>
      code(
        "INSERT INTO in_app_notifications (user_sub, event_id, topic) VALUES ($1, $2, 't')",
        [sub, event],
      );

    it('event_id = period_open:2026-11 chèn được; lặp (event_id, user_sub) → 23505', async () => {
      expect(await ins('period_open:2026-11')).toBe('OK');
      expect(await ins('period_open:2026-11')).toBe('23505');
      expect(await ins('period_open:2026-11', 'p3-u2')).toBe('OK');
    });

    it('event_id NULL → 23502', async () => {
      expect(await ins(null)).toBe('23502');
    });
  });

  it('line_deliveries.qty = 0 → 23514, qty = 1 → OK', async () => {
    const ins = (qty: number) =>
      code(
        "INSERT INTO line_deliveries (line_id, qty, actor_sub, created_at) VALUES ($1, $2, 'a', now())",
        [lineId, qty],
      );
    expect(await ins(0)).toBe('23514');
    expect(await ins(1)).toBe('OK');
  });

  it('xóa dòng có line_deliveries → 23001 line_deliveries_line_id_fkey', async () => {
    const v = await violation('DELETE FROM request_lines WHERE id = $1', [
      lineId,
    ]);
    expect(v).toMatchObject({
      code: '23001',
      constraint: 'line_deliveries_line_id_fkey',
    });
  });

  it('xóa dòng có movement ref_line_id → 23001 stock_movements_ref_line_id_fkey', async () => {
    const id = await newLine('p3-u3');
    await pool.query(
      "INSERT INTO stock_movements (item_id, delta, reason, ref_line_id, actor_sub) VALUES ($1, -1, 'delivery', $2, 'a')",
      [itemId, id],
    );
    const v = await violation('DELETE FROM request_lines WHERE id = $1', [id]);
    expect(v).toMatchObject({
      code: '23001',
      constraint: 'stock_movements_ref_line_id_fkey',
    });
  });

  it('report_snapshots.kind: pdf → 23514, xlsx/print → OK', async () => {
    const ins = (kind: string) =>
      code(
        `INSERT INTO report_snapshots (period_ym, kind, data, created_by_sub, created_at)
         VALUES ('2026-11-01', $1, '{}'::jsonb, 'a', now())`,
        [kind],
      );
    expect(await ins('pdf')).toBe('23514');
    expect(await ins('xlsx')).toBe('OK');
    expect(await ins('print')).toBe('OK');
  });

  it('items.min_stock không còn', async () => {
    const { rows } = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'min_stock'",
    );
    expect(rows).toHaveLength(0);
  });
});
