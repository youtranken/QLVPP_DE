import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };

describe('0100 catalog — ràng buộc item_categories / items / stock_movements', () => {
  let pool: Pool;
  let itemId: string;
  let deliveryId: string;

  async function code(sql: string, params: unknown[] = []): Promise<string> {
    try {
      await pool.query(sql, params);
    } catch (e) {
      return (e as { code: string }).code;
    }
    return 'OK';
  }

  const insertItem = (extra: string, vals: unknown[] = []) =>
    code(
      `INSERT INTO items (name, unit${extra ? ', ' + extra.split('|')[0] : ''})
       VALUES ('x', $1${extra ? ', ' + extra.split('|')[1] : ''})`,
      ['cai', ...vals],
    );

  const insertMove = (
    delta: number,
    reason: string,
    note: string | null,
    ref: string | null = null,
    recipient: string | null = null,
  ) =>
    code(
      `INSERT INTO stock_movements
         (item_id, delta, reason, note, ref_movement_id, recipient_sub, actor_sub)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin')`,
      [itemId, delta, reason, note, ref, recipient],
    );

  beforeAll(async () => {
    const url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
    await pool.query("INSERT INTO users (sub) VALUES ('u-recv')");
    const item = await pool.query<{ id: string }>(
      "INSERT INTO items (name, unit) VALUES ('Bút bi', 'cay') RETURNING id",
    );
    itemId = item.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('items', () => {
    it('stock_qty = -1 → 23514', async () => {
      expect(await insertItem('stock_qty|$2', [-1])).toBe('23514');
    });
    it('max_qty = 0 → 23514', async () => {
      expect(await insertItem('max_qty|$2', [0])).toBe('23514');
    });
    it('restock_level = 0 → 23514 (mốc là tồn sau nhập mua, luôn > 0)', async () => {
      expect(await insertItem('restock_level|$2', [0])).toBe('23514');
    });
    it("unit = 'kg' (không có trong units, 0111) → 23503", async () => {
      expect(
        await code("INSERT INTO items (name, unit) VALUES ('x', 'kg')"),
      ).toBe('23503');
    });
    it('code trùng → 23505; code NULL nhiều dòng vẫn được', async () => {
      const ins =
        "INSERT INTO items (code, name, unit) VALUES ($1, 'x', 'cai')";
      expect(await code(ins, ['BB-01'])).toBe('OK');
      expect(await code(ins, ['BB-01'])).toBe('23505');
      expect(await code(ins, [null])).toBe('OK');
      expect(await code(ins, [null])).toBe('OK');
    });
    it('category_id không tồn tại → 23503', async () => {
      expect(
        await code(
          "INSERT INTO items (name, unit, category_id) VALUES ('x','cai', gen_random_uuid())",
        ),
      ).toBe('23503');
    });
    it('image_file_id không tồn tại → 23503', async () => {
      expect(
        await code(
          "INSERT INTO items (name, unit, image_file_id) VALUES ('x','cai', gen_random_uuid())",
        ),
      ).toBe('23503');
    });
    it('mặc định: max_qty 20, stock_qty 0, restock_level NULL, active true', async () => {
      const { rows } = await pool.query(
        'SELECT max_qty, stock_qty, restock_level, active, low_stock_notified_at FROM items WHERE id = $1',
        [itemId],
      );
      expect(rows[0]).toEqual({
        max_qty: 20,
        stock_qty: 0,
        restock_level: null,
        active: true,
        low_stock_notified_at: null,
      });
    });
  });

  describe('item_categories', () => {
    it("'Giấy' rồi 'giấy' → 23505", async () => {
      const ins = 'INSERT INTO item_categories (name) VALUES ($1)';
      expect(await code(ins, ['Giấy'])).toBe('OK');
      expect(await code(ins, ['giấy'])).toBe('23505');
    });
  });

  describe('stock_movements', () => {
    it('purchase delta=-1 → 23514', async () => {
      expect(await insertMove(-1, 'purchase', null)).toBe('23514');
    });
    it('delta = 0 → 23514', async () => {
      expect(await insertMove(0, 'adjust', 'ghi chú')).toBe('23514');
    });
    it('reason ngoài danh sách → 23514', async () => {
      expect(await insertMove(1, 'gift', 'x')).toBe('23514');
    });
    it('adjust không note → 23514; có note → OK', async () => {
      expect(await insertMove(3, 'adjust', null)).toBe('23514');
      expect(await insertMove(-3, 'adjust', 'kiểm kê')).toBe('OK');
    });
    it('issue thiếu note → 23514; delta=-2 note="người mới" → OK', async () => {
      expect(await insertMove(-2, 'issue', null)).toBe('23514');
      expect(await insertMove(-2, 'issue', 'người mới')).toBe('OK');
    });
    it('issue với recipient_sub hợp lệ OK, không tồn tại → 23503', async () => {
      expect(await insertMove(-1, 'issue', 'n', null, 'u-recv')).toBe('OK');
      expect(await insertMove(-1, 'issue', 'n', null, 'ghost')).toBe('23503');
    });
    it('return thiếu ref_movement_id → 23514', async () => {
      expect(await insertMove(2, 'return', null)).toBe('23514');
    });
    it('delivery delta<0 OK; return có ref hợp lệ OK, ref không tồn tại → 23503', async () => {
      expect(await insertMove(-4, 'delivery', null)).toBe('OK');
      const { rows } = await pool.query<{ id: string }>(
        "SELECT id FROM stock_movements WHERE reason = 'delivery' LIMIT 1",
      );
      deliveryId = rows[0].id;
      expect(await insertMove(4, 'return', null, deliveryId)).toBe('OK');
      expect(
        await insertMove(
          4,
          'return',
          null,
          '00000000-0000-4000-8000-000000000000',
        ),
      ).toBe('23503');
    });
    it('ref_line_id có FK từ 0102 → dòng không tồn tại 23503', async () => {
      expect(
        await code(
          `INSERT INTO stock_movements (item_id, delta, reason, ref_line_id, actor_sub)
           VALUES ($1, 5, 'purchase', gen_random_uuid(), 'admin')`,
          [itemId],
        ),
      ).toBe('23503');
    });
    it('item_id không tồn tại → 23503', async () => {
      expect(
        await code(
          `INSERT INTO stock_movements (item_id, delta, reason, actor_sub)
           VALUES (gen_random_uuid(), 5, 'purchase', 'admin')`,
        ),
      ).toBe('23503');
    });
    it('có index (item_id, created_at) và items(category_id)', async () => {
      const { rows } = await pool.query<{ indexdef: string }>(
        "SELECT indexdef FROM pg_indexes WHERE tablename IN ('stock_movements','items')",
      );
      const defs = rows.map((r) => r.indexdef).join('\n');
      expect(defs).toMatch(/stock_movements.*\(item_id, created_at\)/);
      expect(defs).toMatch(/items.*\(category_id\)/);
    });
  });
});
