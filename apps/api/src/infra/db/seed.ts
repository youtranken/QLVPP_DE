import { createHash } from 'node:crypto';
import { copyFile, mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { count, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { parseToolEnv } from '../config/env';
import { loadRootEnv } from '../config/load-env';
import * as schema from './schema';
import { categories, departments, items } from './schema';
import { SEED_CATALOG, SEED_DEPARTMENTS, type SeedItem } from './seed-data';

/** Ảnh minh hoạ kèm theo danh mục. Đường dẫn giống `migrate.ts`: chạy được cả từ `src/` lẫn `dist/`. */
const ASSET_DIR = resolve(__dirname, '../../../seed-assets/catalog');

/** Đuôi file ảnh chấp nhận được, đúng bộ mà `UploadsController` phục vụ. */
const IMAGE_EXTENSIONS = ['.jpg', '.png', '.webp', '.gif'] as const;

/**
 * Tên file trong thư mục uploads, suy ra từ tên ảnh nguồn nên **không đổi giữa các lần
 * chạy** — seed lại không sinh thêm file rác. Phải đúng khuôn `uuid.ext` vì
 * `UploadsController` chỉ phục vụ file đúng khuôn đó.
 */
function storedFileName(image: string, extension: string): string {
  const hex = createHash('sha1').update(`vpp-catalog:${image}`).digest('hex');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  return `${uuid}${extension}`;
}

/**
 * Chép ảnh minh hoạ vào thư mục uploads và trả về đường dẫn phục vụ.
 * Ảnh nằm trên đĩa như mọi ảnh khác (ADR-0007), DB chỉ giữ đường dẫn.
 * Thiếu file ảnh thì bỏ qua món đó chứ không làm hỏng cả lần seed.
 */
async function installImage(item: SeedItem, uploadDir: string): Promise<string | null> {
  if (!item.image) return null;

  for (const extension of IMAGE_EXTENSIONS) {
    const source = join(ASSET_DIR, `${item.image}${extension}`);
    try {
      await access(source);
    } catch {
      continue;
    }
    const filename = storedFileName(item.image, extension);
    await copyFile(source, join(uploadDir, filename));
    return `/api/uploads/${filename}`;
  }

  console.warn(`Không thấy ảnh cho món "${item.name}" (${item.image}) trong ${ASSET_DIR}.`);
  return null;
}

/**
 * Nạp danh mục và phòng ban. **Chạy lại được** (idempotent):
 * bản ghi đã tồn tại thì bỏ qua nhờ unique trên tên nhóm/phòng ban và (nhóm, tên món),
 * riêng ảnh thì điền vào những món còn thiếu — món admin đã tự gắn ảnh giữ nguyên ảnh đó.
 * KHÔNG tạo user — danh tính do PMH ID quản, user sinh ra khi đăng nhập/đồng bộ Directory.
 */
async function main(): Promise<void> {
  loadRootEnv();
  const env = parseToolEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  const uploadDir = resolve(env.UPLOAD_DIR);
  await mkdir(uploadDir, { recursive: true });

  try {
    await db
      .insert(departments)
      .values(SEED_DEPARTMENTS.map((name) => ({ name })))
      .onConflictDoNothing();

    let withImage = 0;
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

      if (group.items.length === 0) continue;

      const values = [];
      for (const [order, item] of group.items.entries()) {
        const imagePath = await installImage(item, uploadDir);
        if (imagePath) withImage += 1;
        values.push({
          categoryId,
          name: item.name,
          unit: item.unit,
          adminOnly: item.adminOnly ?? false,
          sortOrder: order,
          imagePath,
        });
      }

      await db
        .insert(items)
        .values(values)
        .onConflictDoUpdate({
          target: [items.categoryId, items.name],
          // Chỉ điền ảnh còn thiếu. Các cột khác giữ nguyên vì admin được quyền
          // sửa đơn vị / mã / tối đa, seed không được đạp lên chỉnh tay của họ.
          set: { imagePath: sql`coalesce(${items.imagePath}, excluded.image_path)` },
        });
    }

    const [{ value: itemCount }] = await db.select({ value: count() }).from(items);
    console.log(
      `Seed xong: ${SEED_DEPARTMENTS.length} phòng ban, ${SEED_CATALOG.length} nhóm, ` +
        `${itemCount} món trong CSDL, ${withImage} ảnh minh hoạ đã chép vào ${uploadDir}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
