import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('0102 requests — ràng buộc periods / requests / request_lines', () => {
  let pool: Pool;
  let itemId: string;
  let fileId: string;
  let reqId: string;
  const ym = '2026-11-01';

  async function code(sql: string, params: unknown[] = []): Promise<string> {
    try {
      await pool.query(sql, params);
    } catch (e) {
      return (e as { code: string }).code;
    }
    return 'OK';
  }

  async function newRequest(sub: string): Promise<string> {
    await pool.query('INSERT INTO users (sub) VALUES ($1)', [sub]);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub)
       VALUES ($1, $2, $2) RETURNING id`,
      [ym, sub],
    );
    return rows[0].id;
  }

  const insertLine = (cols: string, vals: unknown[], request: string = reqId) =>
    code(
      `INSERT INTO request_lines (request_id, ${cols})
       VALUES ($1, ${vals.map((_, i) => `$${i + 2}`).join(', ')})`,
      [request, ...vals],
    );

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query(
      "INSERT INTO periods (ym, deadline) VALUES ($1, '2026-11-11T00:00:00+07')",
      [ym],
    );
    const item = await pool.query<{ id: string }>(
      "INSERT INTO items (name, unit) VALUES ('Bút bi', 'cay') RETURNING id",
    );
    itemId = item.rows[0].id;
    const file = await pool.query<{ id: string }>(
      `INSERT INTO files (original_name, mime, size_bytes, purpose, uploaded_by_sub)
       VALUES ('a.png', 'image/png', 10, 'line_image', 'u1') RETURNING id`,
    );
    fileId = file.rows[0].id;
    reqId = await newRequest('u1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('phiếu thứ 2 cùng (kỳ, người) → 23505', async () => {
    expect(
      await code(
        `INSERT INTO requests (period_ym, user_sub, created_by_sub)
         VALUES ($1, 'u1', 'u1')`,
        [ym],
      ),
    ).toBe('23505');
  });

  it('phiếu trỏ kỳ không tồn tại → 23503', async () => {
    await pool.query("INSERT INTO users (sub) VALUES ('u-x')");
    expect(
      await code(
        `INSERT INTO requests (period_ym, user_sub, created_by_sub)
         VALUES ('2030-01-01', 'u-x', 'u-x')`,
      ),
    ).toBe('23503');
  });

  it('qty=0 → 23514', async () => {
    expect(await insertLine('item_id, qty', [itemId, 0])).toBe('23514');
  });

  it('delivered_qty > qty → 23514', async () => {
    expect(
      await insertLine('item_id, qty, delivered_qty', [itemId, 2, 3]),
    ).toBe('23514');
  });

  it('delivered_qty = qty và delivered + cancelled = qty → OK (biên CHECK)', async () => {
    const r = await newRequest('u-delivered-eq');
    expect(
      await insertLine('item_id, qty, delivered_qty', [itemId, 2, 2], r),
    ).toBe('OK');
    const r2 = await newRequest('u-delivered-cancel-eq');
    expect(
      await insertLine(
        'item_id, qty, delivered_qty, cancelled_qty',
        [itemId, 3, 2, 1],
        r2,
      ),
    ).toBe('OK');
  });

  it('delivered + cancelled > qty → 23514', async () => {
    expect(
      await insertLine('item_id, qty, delivered_qty, cancelled_qty', [
        itemId,
        3,
        2,
        2,
      ]),
    ).toBe('23514');
  });

  it('cancelled_qty > qty (chưa giao) → 23514', async () => {
    expect(
      await insertLine('item_id, qty, cancelled_qty', [itemId, 2, 3]),
    ).toBe('23514');
  });

  it('dòng ngoài DM mà cũng có item_id → 23514', async () => {
    expect(
      await insertLine(
        'item_id, custom_name, custom_unit, image_file_id, qty, review_status',
        [itemId, 'But', 'cay', fileId, 1, 'pending'],
      ),
    ).toBe('23514');
  });

  it("item_id NULL + review 'n/a' → 23514", async () => {
    expect(
      await insertLine(
        'custom_name, custom_unit, image_file_id, qty, review_status',
        ['But', 'cay', fileId, 1, 'n/a'],
      ),
    ).toBe('23514');
  });

  it("item_id NOT NULL + 'pending' → 23514", async () => {
    expect(
      await insertLine('item_id, qty, review_status', [itemId, 1, 'pending']),
    ).toBe('23514');
  });

  it('request_lines cho dòng ngoài DM không ảnh → OK; có item_id kèm custom_name vẫn 23514', async () => {
    expect(
      await insertLine('custom_name, custom_unit, qty, review_status', [
        'But',
        'cay',
        1,
        'pending',
      ]),
    ).toBe('OK');
    expect(
      await insertLine(
        'item_id, custom_name, custom_unit, qty, review_status',
        [itemId, 'But', 'cay', 1, 'pending'],
      ),
    ).toBe('23514');
  });

  it('dòng ngoài DM thiếu custom_unit → 23514', async () => {
    expect(
      await insertLine('custom_name, image_file_id, qty, review_status', [
        'But',
        fileId,
        1,
        'pending',
      ]),
    ).toBe('23514');
  });

  it('dòng ngoài DM đủ ảnh + đơn vị, pending → OK', async () => {
    expect(
      await insertLine(
        'custom_name, custom_unit, image_file_id, qty, review_status',
        ['But', 'cay', fileId, 1, 'pending'],
      ),
    ).toBe('OK');
  });

  it("hai dòng cùng món 'n/a' cùng phiếu → 23505; 'n/a' + 'converted' → OK", async () => {
    const r = await newRequest('u2');
    expect(await insertLine('item_id, qty', [itemId, 1], r)).toBe('OK');
    expect(await insertLine('item_id, qty', [itemId, 1], r)).toBe('23505');
    expect(
      await insertLine(
        'item_id, qty, review_status',
        [itemId, 1, 'converted'],
        r,
      ),
    ).toBe('OK');
  });

  it('movement tham chiếu dòng → xóa dòng 23001 (RESTRICT); xóa phiếu cascade dòng chưa có movement', async () => {
    const r = await newRequest('u3');
    const line = await pool.query<{ id: string }>(
      `INSERT INTO request_lines (request_id, item_id, qty)
       VALUES ($1, $2, 5) RETURNING id`,
      [r, itemId],
    );
    await pool.query(
      `INSERT INTO stock_movements (item_id, delta, reason, ref_line_id, actor_sub)
       VALUES ($1, -1, 'delivery', $2, 'admin')`,
      [itemId, line.rows[0].id],
    );
    // ON DELETE RESTRICT báo restrict_violation 23001 (NO ACTION mới là 23503).
    expect(
      await code('DELETE FROM request_lines WHERE id = $1', [line.rows[0].id]),
    ).toBe('23001');
    expect(await code('DELETE FROM requests WHERE id = $1', [r])).toBe('23001');

    const r2 = await newRequest('u4');
    await pool.query(
      'INSERT INTO request_lines (request_id, item_id, qty) VALUES ($1, $2, 1)',
      [r2, itemId],
    );
    await pool.query('DELETE FROM requests WHERE id = $1', [r2]);
    const { rows } = await pool.query(
      'SELECT 1 FROM request_lines WHERE request_id = $1',
      [r2],
    );
    expect(rows).toHaveLength(0);
  });

  it('updated_at và created_at mặc định now()', async () => {
    const { rows } = await pool.query<{ a: Date; b: Date; c: Date }>(
      `SELECT r.created_at a, r.updated_at b, p.created_at c
       FROM requests r, periods p WHERE r.id = $1`,
      [reqId],
    );
    expect(rows[0].a).toBeInstanceOf(Date);
    expect(rows[0].b).toBeInstanceOf(Date);
    expect(rows[0].c).toBeInstanceOf(Date);
  });
});
