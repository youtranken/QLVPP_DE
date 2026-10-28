import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Thiếu DATABASE_URL.');
  process.exit(1);
}
const seed = JSON.parse(
  readFileSync(new URL('../seed/catalog.json', import.meta.url), 'utf8'),
);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  for (const c of seed.categories) {
    // Khớp theo lower(name) để không đụng nhóm admin đã tạo tay
    await client.query(
      `INSERT INTO item_categories (name, sort_order) VALUES ($1, $2)
       ON CONFLICT (lower(name)) DO NOTHING`,
      [c.name, c.sort_order],
    );
  }
  for (const i of seed.items) {
    // Chỉ cập nhật trường danh mục; stock_qty, image_file_id, active là của admin
    await client.query(
      `INSERT INTO items (code, name, name_en, unit, max_qty, admin_only, sort_order, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               (SELECT id FROM item_categories WHERE lower(name) = lower($8)))
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name, name_en = EXCLUDED.name_en, unit = EXCLUDED.unit,
         max_qty = EXCLUDED.max_qty, admin_only = EXCLUDED.admin_only,
         category_id = EXCLUDED.category_id, updated_at = now()`,
      [
        i.code,
        i.name,
        i.name_en,
        i.unit,
        i.max_qty,
        i.admin_only,
        i.sort_order,
        i.category,
      ],
    );
  }
  await client.query('COMMIT');
  console.log(
    `Seed xong: ${seed.categories.length} nhóm, ${seed.items.length} món.`,
  );
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
