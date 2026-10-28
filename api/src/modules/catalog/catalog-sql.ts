import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// FR-50: đã dùng hết 80 % tồn sau lần nhập mua gần nhất; tồn 0 là "Hết hàng", không tính vào đây
export const LOW_STOCK_SQL =
  'restock_level > 0 AND stock_qty > 0 AND stock_qty <= floor(restock_level * 0.2)';

export type StockState = 'ok' | 'low' | 'out' | 'untracked';

export const ITEM_COLUMNS = sql.raw(
  `id, code, name, name_en, unit, pack_note, category_id, image_file_id, admin_only, max_qty, stock_qty, restock_level,
   CASE WHEN restock_level IS NULL THEN 'untracked' WHEN stock_qty = 0 THEN 'out'
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

export interface CategoryRow extends Record<string, unknown> {
  id: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
}

// Chỉ nhận khóa đã qua DTO whitelist; tên cột là định danh có quote, giá trị là tham số
export function setClause(patch: Record<string, unknown>): SQL {
  return sql.join(
    Object.entries(patch).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`),
    sql`, `,
  );
}

export function definedEntries<T extends object>(
  dto: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(dto).filter(([, v]) => v !== undefined),
  );
}

export function pick(
  row: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, row[k]]));
}

// drizzle bọc lỗi pg trong DrizzleQueryError.cause
export function pgViolation(
  error: unknown,
): { code: string; constraint?: string } | null {
  for (let e = error as { code?: unknown; cause?: unknown } | undefined; e;) {
    if (typeof e.code === 'string' && /^\d{5}$/.test(e.code)) {
      return e as { code: string; constraint?: string };
    }
    e = e.cause as typeof e;
  }
  return null;
}
