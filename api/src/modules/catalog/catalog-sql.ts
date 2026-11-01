import { sql } from 'drizzle-orm';

// FR-50: đã dùng hết 80 % tồn sau lần nhập mua gần nhất; tồn 0 là "Hết hàng", không tính vào đây
export const LOW_STOCK_SQL =
  'restock_level > 0 AND stock_qty > 0 AND stock_qty <= floor(restock_level * 0.2)';

// Món dùng được: món active và nhóm (nếu có) active — ngừng nhóm không sửa items.active
export const ITEM_USABLE_SQL = sql.raw(
  '(items.active AND NOT EXISTS (SELECT 1 FROM item_categories c WHERE c.id = items.category_id AND NOT c.active))',
);

export type StockState = 'ok' | 'low' | 'out' | 'untracked';

export const ITEM_COLUMNS = sql.raw(
  // Tồn 0 luôn là Hết hàng, kể cả món chưa có mốc nhập mua
  `id, code, name, name_en, unit, pack_note, category_id, image_file_id, admin_only, max_qty, stock_qty, restock_level,
   CASE WHEN stock_qty = 0 THEN 'out' WHEN restock_level IS NULL THEN 'untracked'
        WHEN ${LOW_STOCK_SQL} THEN 'low' ELSE 'ok' END AS stock_state,
   active, sort_order`,
);

export const CATEGORY_COLUMNS = sql.raw(
  'id, name, name_en, sort_order, active',
);

export interface ItemRow extends Record<string, unknown> {
  id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  category_id: string | null;
  image_file_id: string | null;
  admin_only: boolean;
  max_qty: number;
  stock_qty: number;
  restock_level: number | null;
  stock_state: StockState;
  active: boolean;
  sort_order: number;
}

export interface ItemFacts extends Record<string, unknown> {
  id: string;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  image_file_id: string | null;
  active: boolean;
  admin_only: boolean;
  max_qty: number;
}

export interface CategoryRow extends Record<string, unknown> {
  id: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
}
