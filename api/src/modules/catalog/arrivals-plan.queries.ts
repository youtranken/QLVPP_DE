import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { CUSTOM_ITEM_KEY, UNDELIVERED_LINE } from '../requests/line-predicates';

export interface ItemFactsRow {
  item_id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  category_id: string | null;
  image_file_id: string | null;
  stock_qty: number;
  usable: boolean;
  inactive_reason: 'item' | 'category' | null;
  received: number;
  adm_out: boolean;
  open_lines: number;
  reduced_after_snapshot: number;
}

export interface BatchRow {
  at: string;
  actor_name: string | null;
  items: number;
  units: number;
  note: string | null;
}

type Row<T> = T & Record<string, unknown>;

// Ghi chú movement = tiền tố tự động + " · " + ghi chú người nhập; đợt chỉ trả phần người nhập
const RECEIPT_NOTE_PREFIX = '^(Hàng về kỳ|Về bù kỳ) \\d{4}-\\d{2}( · )?';

// Món của kế hoạch + món đã có hàng về kỳ này (thêm bằng "Thêm món khác" ở đợt trước); thứ tự danh mục chung
export async function itemFacts(
  ex: Executor,
  ym: string,
  ids: string[],
  snapshotAt: string | null,
): Promise<ItemFactsRow[]> {
  const k = ymToDate(ym);
  const { rows } = await ex.execute<Row<ItemFactsRow>>(sql`
    WITH ids AS (
      SELECT unnest(${sql.param(ids)}::uuid[]) AS id
      UNION
      SELECT item_id FROM stock_movements WHERE reason = 'purchase' AND receipt_ym = ${k}::date
    )
    SELECT i.id AS item_id, i.code, i.name, i.name_en, i.unit, i.category_id, i.image_file_id,
           i.stock_qty, (i.active AND coalesce(c.active, true)) AS usable,
           CASE WHEN NOT i.active THEN 'item' WHEN NOT coalesce(c.active, true) THEN 'category' END AS inactive_reason,
           coalesce((SELECT sum(delta) FROM stock_movements m
                     WHERE m.item_id = i.id AND m.reason = 'purchase' AND m.receipt_ym = ${k}::date), 0)::int AS received,
           EXISTS (SELECT 1 FROM period_adm_out a
                   WHERE a.period_ym = ${k}::date AND a.line_key = i.id::text AND a.kind = 'out') AS adm_out,
           (SELECT count(*) FROM request_lines l JOIN requests r ON r.id = l.request_id
            WHERE l.item_id = i.id AND r.period_ym = ${k}::date AND ${UNDELIVERED_LINE})::int AS open_lines,
           coalesce((SELECT sum(a.qty_before - a.qty_after) FROM request_line_adjustments a
                     WHERE a.item_id = i.id AND a.period_ym <= ${k}::date
                       AND a.created_at > ${snapshotAt}::timestamptz), 0)::int AS reduced_after_snapshot
    FROM ids JOIN items i ON i.id = ids.id
    LEFT JOIN item_categories c ON c.id = i.category_id
    ORDER BY c.sort_order NULLS LAST, lower(c.name), c.id, i.sort_order, lower(i.name), i.id`);
  return rows;
}

export async function customFacts(
  ex: Executor,
  ym: string,
): Promise<
  Map<string, { received: number; adm_out: boolean; open_lines: number }>
> {
  const k = ymToDate(ym);
  const { rows } = await ex.execute<
    Row<{ key: string; received: number; adm_out: boolean; open_lines: number }>
  >(sql`
    WITH keys AS (
      SELECT line_key AS key FROM custom_receipts WHERE period_ym = ${k}::date
      UNION SELECT line_key FROM period_adm_out WHERE period_ym = ${k}::date AND kind = 'out'
      UNION SELECT ${CUSTOM_ITEM_KEY} FROM request_lines l JOIN requests r ON r.id = l.request_id
            WHERE l.item_id IS NULL AND r.period_ym = ${k}::date
    )
    SELECT keys.key,
           coalesce((SELECT sum(qty) FROM custom_receipts c
                     WHERE c.period_ym = ${k}::date AND c.line_key = keys.key), 0)::int AS received,
           EXISTS (SELECT 1 FROM period_adm_out a
                   WHERE a.period_ym = ${k}::date AND a.line_key = keys.key AND a.kind = 'out') AS adm_out,
           (SELECT count(*) FROM request_lines l JOIN requests r ON r.id = l.request_id
            WHERE l.item_id IS NULL AND r.period_ym = ${k}::date AND ${UNDELIVERED_LINE}
              AND ${CUSTOM_ITEM_KEY} = keys.key)::int AS open_lines
    FROM keys`);
  return new Map(rows.map(({ key, ...rest }) => [key, rest]));
}

// Mỗi lần POST hàng về ghi mọi movement trong một giao dịch (cùng now()) → một đợt
export async function receiptBatches(
  ex: Executor,
  ym: string,
): Promise<BatchRow[]> {
  const { rows } = await ex.execute<Row<BatchRow>>(sql`
    SELECT to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at,
           coalesce(u.full_name, m.actor_sub) AS actor_name,
           count(DISTINCT m.item_id)::int AS items, sum(m.delta)::int AS units,
           nullif(max(regexp_replace(m.note, ${RECEIPT_NOTE_PREFIX}, '')), '') AS note
    FROM stock_movements m LEFT JOIN users u ON u.sub = m.actor_sub
    WHERE m.reason = 'purchase' AND m.receipt_ym = ${ymToDate(ym)}::date
    GROUP BY m.created_at, m.actor_sub, u.full_name
    ORDER BY m.created_at DESC`);
  return rows;
}

export async function itemsByIds(
  ex: Executor,
  ids: string[],
): Promise<
  Map<
    string,
    { name: string; name_en: string | null; unit: string; stock_qty: number }
  >
> {
  if (ids.length === 0) return new Map();
  const { rows } = await ex.execute<
    Row<{
      id: string;
      name: string;
      name_en: string | null;
      unit: string;
      stock_qty: number;
    }>
  >(sql`
    SELECT id, name, name_en, unit, stock_qty FROM items
    WHERE id = ANY(${sql.param(ids)}::uuid[])`);
  return new Map(rows.map(({ id, ...rest }) => [id, rest]));
}
