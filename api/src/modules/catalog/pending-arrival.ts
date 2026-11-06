import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { hasItemsSql } from '../reports/sent-snapshot';
import { itemNotFound } from './catalog.service';

export type PendingArrival =
  { remaining: number; unit: string; snapshot_at: string } | { remaining: 0 };

// Phần bản in kỳ khóa gần nhất còn chờ ADM giao; món đánh "ADM hết hàng" thì không còn chờ
export async function pendingArrival(
  ex: Executor,
  itemId: string,
  lockedYm: string,
): Promise<PendingArrival> {
  const k = ymToDate(lockedYm);
  const { rows } = await ex.execute<{
    unit: string;
    ordered: number | null;
    received: number;
    snapshot_at: Date | string | null;
    adm_out: boolean;
  }>(sql`
    SELECT i.unit, sent.ordered, sent.created_at AS snapshot_at,
           coalesce((SELECT sum(delta) FROM stock_movements
                     WHERE item_id = i.id AND reason = 'purchase' AND receipt_ym = ${k}::date), 0)::int AS received,
           EXISTS (SELECT 1 FROM period_adm_out
                   WHERE period_ym = ${k}::date AND line_key = i.id::text AND kind = 'out') AS adm_out
    FROM items i
    LEFT JOIN LATERAL (
      SELECT (data->'order_qty'->>i.id::text)::int AS ordered, created_at
      FROM report_snapshots
      WHERE period_ym = ${k}::date AND ${hasItemsSql}
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) sent ON true
    WHERE i.id = ${itemId}`);
  const row = rows[0];
  if (!row) throw itemNotFound();
  const remaining = Math.max(0, (row.ordered ?? 0) - row.received);
  if (row.adm_out || remaining === 0 || !row.snapshot_at)
    return { remaining: 0 };
  return {
    remaining,
    unit: row.unit,
    snapshot_at: new Date(row.snapshot_at).toISOString(),
  };
}
