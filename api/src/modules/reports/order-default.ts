import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import {
  CUSTOM_ITEM_KEY,
  REMAINING_QTY,
  UNDELIVERED_LINE,
} from '../requests/line-predicates';
import { wantOf } from './report-need';
import type { OrderBasis } from './report.types';
import { hasItemsSql } from './sent-snapshot';

export interface OrderBasisInput {
  requested: number;
  backlog_prev: number;
  adm_owed?: number;
  left_excluded?: number;
  usable?: boolean;
}

// requested_active + debt_active = số gộp − phần của người đã nghỉ
export function activeNeed(r: OrderBasisInput): number {
  return wantOf(r) - (r.left_excluded ?? 0);
}

export function defaultOrder(r: OrderBasisInput): number {
  return (r.usable ?? true)
    ? Math.max(0, activeNeed(r) - (r.adm_owed ?? 0))
    : 0;
}

export interface AdmOwedRow {
  period_ym: string;
  key: string;
  ordered: number;
  received: number;
  owed: number;
}

// ADM giao thiếu kỳ P < ym còn hứa bù: không đặt lại; hết hứa khi kỳ P đánh "ADM hết hàng" hoặc "ADM không giao nữa"
export async function admOwedRows(
  ex: Executor,
  ym: string,
): Promise<AdmOwedRow[]> {
  const before = ymToDate(ym);
  const { rows } = await ex.execute<AdmOwedRow & Record<string, unknown>>(sql`
    WITH sent AS (
      SELECT DISTINCT ON (period_ym) period_ym, data->'order_qty' AS order_qty
      FROM report_snapshots
      WHERE period_ym < ${before}::date AND ${hasItemsSql}
      ORDER BY period_ym, created_at DESC, id DESC
    ), ordered AS (
      SELECT s.period_ym, e.key, e.value::int AS qty
      FROM sent s, jsonb_each_text(s.order_qty) e WHERE e.value::int > 0
    ), received AS (
      SELECT receipt_ym AS period_ym, item_id::text AS key, sum(delta)::int AS qty
      FROM stock_movements
      WHERE reason = 'purchase' AND receipt_ym < ${before}::date GROUP BY 1, 2
      UNION ALL
      SELECT period_ym, line_key, sum(qty)::int FROM custom_receipts
      WHERE period_ym < ${before}::date GROUP BY 1, 2
    ), waiting AS (
      SELECT r.period_ym, coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key,
             sum(${REMAINING_QTY})::int AS qty
      FROM request_lines l JOIN requests r ON r.id = l.request_id
      JOIN users u ON u.sub = r.user_sub AND u.status = 'active'
      WHERE ${UNDELIVERED_LINE} AND r.period_ym < ${before}::date
      GROUP BY 1, 2
    )
    SELECT to_char(o.period_ym, 'YYYY-MM') AS period_ym, o.key, o.qty AS ordered,
           coalesce(rc.qty, 0)::int AS received,
           LEAST(GREATEST(0, o.qty - coalesce(rc.qty, 0)), coalesce(w.qty, 0))::int AS owed
    FROM ordered o
    LEFT JOIN (SELECT period_ym, key, sum(qty) AS qty FROM received GROUP BY 1, 2) rc
      ON rc.period_ym = o.period_ym AND rc.key = o.key
    LEFT JOIN waiting w ON w.period_ym = o.period_ym AND w.key = o.key
    WHERE NOT EXISTS (
      SELECT 1 FROM period_adm_out a WHERE a.period_ym = o.period_ym AND a.line_key = o.key
    )
    ORDER BY o.period_ym, o.key`);
  return rows.filter((r) => r.owed > 0);
}

export async function admOwedByKey(
  ex: Executor,
  ym: string,
): Promise<Map<string, number>> {
  const owed = new Map<string, number>();
  for (const r of await admOwedRows(ex, ym)) {
    owed.set(r.key, (owed.get(r.key) ?? 0) + r.owed);
  }
  return owed;
}

export async function admOwed(
  ex: Executor,
  ym: string,
  key: string,
): Promise<number> {
  return (await admOwedByKey(ex, ym)).get(key) ?? 0;
}

export function orderBasisOf(
  rows: (OrderBasisInput & { key: string })[],
): Record<string, OrderBasis> {
  return Object.fromEntries(
    rows.map((r) => [
      r.key,
      {
        requested: r.requested,
        debt: r.backlog_prev,
        adm_owed: r.adm_owed ?? 0,
        left_excluded: r.left_excluded ?? 0,
        discontinued: r.usable === false,
      },
    ]),
  );
}
