import { sql } from 'drizzle-orm';
import type { StockState } from './stock-state';

// Món dùng được: món active và nhóm (nếu có) active — ngừng nhóm không sửa items.active
export const ITEM_USABLE_SQL = sql.raw(
  '(items.active AND NOT EXISTS (SELECT 1 FROM item_categories c WHERE c.id = items.category_id AND NOT c.active))',
);

export type InactiveReason = 'item' | 'group' | null;

// Ngừng riêng thắng ngừng theo nhóm: bật lại nhóm không làm món ngừng riêng dùng lại
export const ITEM_INACTIVE_REASON_SQL = sql.raw(
  `CASE WHEN NOT items.active THEN 'item'
        WHEN EXISTS (SELECT 1 FROM item_categories c WHERE c.id = items.category_id AND NOT c.active) THEN 'group'
   END`,
);

export type { StockState };

// stock_state không tính ở SQL: điền bằng catalogStates/withStockState (stock-list.ts), cùng nguồn với Tủ
export const ITEM_COLUMNS = sql.raw(`
  id, code, name, name_en, unit, pack_note, category_id, image_file_id, max_qty, stock_qty, restock_level,
  active, sort_order`);

export const CATEGORY_COLUMNS = sql.raw(
  'id, name, name_en, sort_order, active',
);

export interface ItemDbRow extends Record<string, unknown> {
  id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  category_id: string | null;
  image_file_id: string | null;
  max_qty: number;
  stock_qty: number;
  restock_level: number | null;
  active: boolean;
  sort_order: number;
}

export type ItemRow = ItemDbRow & { stock_state: StockState };

export interface ItemFacts extends Record<string, unknown> {
  id: string;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  image_file_id: string | null;
  active: boolean;
  max_qty: number;
}

export interface CategoryRow extends Record<string, unknown> {
  id: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
}
