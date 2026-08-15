import { MAX_ITEM_QTY } from '@vpp/shared';
import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Nhóm danh mục VPP. `isOther=true` = nhóm "Khác" (cho phép tự nhập tên + đính ảnh). */
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  isOther: boolean('is_other').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Món VPP. `adminOnly` = chỉ admin được đăng ký (vd giấy A4 — SDD §6). */
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    /**
     * Mã món do admin tự đặt (vd `BUT-001`). Để trống được — công ty nào chưa có
     * bộ mã vật tư thì vẫn dùng hệ thống bình thường.
     */
    code: text('code'),
    name: text('name').notNull(),
    unit: text('unit').notNull(),
    adminOnly: boolean('admin_only').notNull().default(false),
    maxQty: integer('max_qty').notNull().default(MAX_ITEM_QTY),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * Ảnh minh hoạ món, do admin tải lên (đường dẫn `/api/uploads/<uuid>.<ext>`).
     * Chỉ lưu ĐƯỜNG DẪN, ảnh nằm trên đĩa như ảnh đính kèm mục "Khác" (ADR-0007).
     */
    imagePath: text('image_path'),
  },
  (table) => [
    index('items_category_active_idx').on(table.categoryId, table.active),
    /** Không cho trùng tên món trong cùng một nhóm (cũng giúp seed chạy lại được). */
    uniqueIndex('items_category_name_idx').on(table.categoryId, table.name),
    /**
     * Mã món không được trùng, và **không phân biệt hoa thường**: `BUT-001` với
     * `but-001` phải là một, nếu không hai người nhập hai kiểu sẽ ra hai món.
     * Index từng phần vì mã được phép để trống — nhiều món chưa có mã là bình thường.
     */
    uniqueIndex('items_code_idx')
      .on(sql`upper(${table.code})`)
      .where(sql`${table.code} IS NOT NULL`),
  ],
);
