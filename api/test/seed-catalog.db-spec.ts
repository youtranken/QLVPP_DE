import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runMigrations,
} from '../src/database/migration-runner';
import { assertTestDatabase } from './test-database';

const silent = { log: () => undefined };
const API_DIR = join(__dirname, '..');
const seed = JSON.parse(
  readFileSync(join(API_DIR, 'seed/catalog.json'), 'utf8'),
) as {
  categories: { name: string }[];
  items: {
    code: string;
    unit: string;
    category: string;
    admin_only: boolean;
  }[];
};
const codes = seed.items.map((i) => i.code);

describe('seed danh mục ban đầu', () => {
  let pool: Pool;
  let url: string;

  const runSeed = () =>
    execFileSync('node', ['scripts/seed-catalog.mjs'], {
      cwd: API_DIR,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  const counts = async () => ({
    items: Number(
      (
        await pool.query(
          'SELECT count(*) FROM items WHERE code = ANY($1::text[])',
          [codes],
        )
      ).rows[0].count,
    ),
    cats: Number(
      (await pool.query('SELECT count(*) FROM item_categories')).rows[0].count,
    ),
  });

  beforeAll(async () => {
    url = assertTestDatabase(process.env.DATABASE_URL);
    pool = new Pool({ connectionString: url });
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await runMigrations(pool, resolveMigrationsDir(), silent);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('chạy 2 lần: số nhóm và món không đổi; món seed chưa có ảnh', async () => {
    runSeed();
    const first = await counts();
    expect(first.items).toBe(seed.items.length);
    expect(first.cats).toBe(seed.categories.length);
    runSeed();
    expect(await counts()).toEqual(first);
    const withImage = await pool.query(
      'SELECT 1 FROM items WHERE code = ANY($1::text[]) AND image_file_id IS NOT NULL',
      [codes],
    );
    expect(withImage.rowCount).toBe(0);
  });

  it('chỉ GIAY-A4 là admin_only; mọi món có nhóm', async () => {
    expect(seed.items.filter((i) => i.admin_only).map((i) => i.code)).toEqual([
      'GIAY-A4',
    ]);
    const a4 = await pool.query(
      "SELECT admin_only FROM items WHERE name ILIKE 'Giấy A4%'",
    );
    expect(a4.rows.length).toBeGreaterThan(0);
    expect(a4.rows.every((r) => r.admin_only === true)).toBe(true);
    const orphan = await pool.query(
      'SELECT 1 FROM items WHERE code = ANY($1::text[]) AND category_id IS NULL',
      [codes],
    );
    expect(orphan.rowCount).toBe(0);
  });

  it('món đã có code: seed không đè chỉnh sửa của Hành chính (tên, tối đa, admin_only, nhóm, tồn, trạng thái)', async () => {
    const other = await pool.query<{ id: string }>(
      'SELECT id FROM item_categories ORDER BY sort_order DESC LIMIT 1',
    );
    await pool.query(
      `UPDATE items SET stock_qty = 42, active = false, name = 'Tên Hành chính sửa',
         max_qty = 7, admin_only = true, category_id = $2 WHERE code = $1`,
      [codes[1], other.rows[0].id],
    );
    runSeed();
    const row = (
      await pool.query(
        'SELECT stock_qty, active, name, max_qty, admin_only, category_id FROM items WHERE code = $1',
        [codes[1]],
      )
    ).rows[0];
    expect(row).toEqual({
      stock_qty: 42,
      active: false,
      name: 'Tên Hành chính sửa',
      max_qty: 7,
      admin_only: true,
      category_id: other.rows[0].id,
    });
  });
});
