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
  items: { code: string; unit: string; category: string }[];
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

  it('Giấy A4 là admin_only; mọi món có nhóm', async () => {
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

  it('tồn kho và trạng thái ngừng do admin đặt không bị seed ghi đè', async () => {
    await pool.query(
      'UPDATE items SET stock_qty = 42, active = false, name = $2 WHERE code = $1',
      [codes[0], 'Tên cũ'],
    );
    runSeed();
    const row = (
      await pool.query(
        'SELECT stock_qty, active, name FROM items WHERE code = $1',
        [codes[0]],
      )
    ).rows[0];
    expect(row.stock_qty).toBe(42);
    expect(row.active).toBe(false);
    expect(row.name).toBe((seed.items[0] as unknown as { name: string }).name);
  });
});
