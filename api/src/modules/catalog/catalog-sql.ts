import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { heldSql } from './stock-held-sql';

// Phần đang giữ của một món (bảng items không bí danh); truy vấn nhiều món dùng heldJoin + JOINED_HELD để gộp một lần
const correlatedHeld = (openYm: string): SQL =>
  sql`coalesce((SELECT h.held FROM (${heldSql(openYm)}) h WHERE h.item_id = items.id), 0)`;
export const heldJoin = (openYm: string): SQL =>
  sql`LEFT JOIN (${heldSql(openYm)}) h ON h.item_id = items.id`;
export const JOINED_HELD = sql.raw('coalesce(h.held, 0)');

// Sắp hết theo phần trống (tồn − đang giữ), cùng luật Tủ (stock-state.ts): còn hàng và trống ≤ 20 % mức;
// món thiếu cho người chờ (trống < 0) luôn tính, kể cả chưa có mức — ở Tủ là "Thiếu", không bao giờ là "Còn"
export const lowStockOn = (held: SQL): SQL => sql`(items.stock_qty > 0
  AND items.stock_qty - ${held} <= CASE WHEN items.restock_level > 0
      THEN floor(items.restock_level * 0.2) ELSE -1 END)`;
// Danh sách món sắp hết (Home, KPI, chuông): phần giữ tính một lần cho cả bảng
export const lowStockItemsSql = (openYm: string, columns: SQL): SQL => sql`
  SELECT ${columns} FROM items ${heldJoin(openYm)}
  WHERE items.active AND ${lowStockOn(JOINED_HELD)}`;

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

export type StockState = 'ok' | 'low' | 'out' | 'untracked';

// Tồn 0 luôn là Hết hàng, kể cả món chưa có mốc nhập mua
export const itemColumnsOn = (held: SQL): SQL => sql`
  id, code, name, name_en, unit, pack_note, category_id, image_file_id, admin_only, max_qty, stock_qty, restock_level,
  CASE WHEN stock_qty = 0 THEN 'out' WHEN ${lowStockOn(held)} THEN 'low'
       WHEN restock_level IS NULL THEN 'untracked' ELSE 'ok' END AS stock_state,
  active, sort_order`;
export const itemColumns = (openYm: string): SQL =>
  itemColumnsOn(correlatedHeld(openYm));

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
