import { count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { parseEnv } from '../config/env';
import { loadRootEnv } from '../config/load-env';
import * as schema from './schema';
import { categories, departments, items } from './schema';
import { SEED_CATALOG, SEED_DEPARTMENTS } from './seed-data';

/**
 * Nạp dữ liệu mẫu cho demo. **Chạy lại được** (idempotent):
 * bản ghi đã tồn tại thì bỏ qua nhờ unique trên tên nhóm/phòng ban và (nhóm, tên món).
 * KHÔNG tạo user — danh tính do PMH ID quản, user sinh ra khi đăng nhập/đồng bộ Directory.
 */
async function main(): Promise<void> {
  loadRootEnv();
  const pool = new Pool({ connectionString: parseEnv().DATABASE_URL });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  try {
    await db
      .insert(departments)
      .values(SEED_DEPARTMENTS.map((name) => ({ name })))
      .onConflictDoNothing();

    for (const [index, group] of SEED_CATALOG.entries()) {
      const [category] = await db
        .insert(categories)
        .values({ name: group.name, isOther: group.isOther ?? false, sortOrder: index })
        .onConflictDoNothing()
        .returning({ id: categories.id });

      // onConflictDoNothing không trả về hàng khi nhóm đã có sẵn → đọc lại id.
      const categoryId =
        category?.id ??
        (
          await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.name, group.name))
        )[0]?.id;
      if (!categoryId) throw new Error(`Không lấy được id nhóm "${group.name}"`);

      if (group.items.length > 0) {
        await db
          .insert(items)
          .values(
            group.items.map((item, order) => ({
              categoryId,
              name: item.name,
              unit: item.unit,
              adminOnly: item.adminOnly ?? false,
              sortOrder: order,
            })),
          )
          .onConflictDoNothing();
      }
    }

    const [{ value: itemCount }] = await db.select({ value: count() }).from(items);
    console.log(
      `Seed xong: ${SEED_DEPARTMENTS.length} phòng ban, ${SEED_CATALOG.length} nhóm, ${itemCount} món.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
