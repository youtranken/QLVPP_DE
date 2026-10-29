import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Tx } from '../../database/database.module';
import { EFFECTIVE_LINE } from './line-predicates';

export interface LockedLine {
  id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  item_id: string | null;
  custom_name: string | null;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  review_status: string;
}

// Ghi request_lines cho giao/hủy nợ ở lại module requests; delivery chỉ gọi qua đây
@Injectable()
export class LineDeliveryStore {
  // Khóa phiếu trước rồi dòng — cùng thứ tự với writer và review (requests → request_lines → items)
  async lockLine(tx: Tx, lineId: string): Promise<LockedLine | null> {
    const head = await tx.execute<{ id: string }>(sql`
      SELECT r.id FROM requests r JOIN request_lines l ON l.request_id = r.id
      WHERE l.id = ${lineId} FOR UPDATE OF r
    `);
    if (head.rows.length === 0) return null;
    const { rows } = await tx.execute<LockedLine & Record<string, unknown>>(sql`
      SELECT l.id, l.request_id, to_char(r.period_ym, 'YYYY-MM') AS period_ym, r.user_sub,
             l.item_id, l.custom_name, l.qty, l.delivered_qty, l.cancelled_qty,
             l.review_status
      FROM request_lines l JOIN requests r ON r.id = l.request_id
      WHERE l.id = ${lineId} FOR UPDATE OF l
    `);
    return rows[0] ?? null;
  }

  async addDelivered(
    tx: Tx,
    lineId: string,
    qty: number,
    expected: number,
    now: Date,
  ): Promise<boolean> {
    const at = now.toISOString();
    const result = await tx.execute(sql`
      UPDATE request_lines
      SET delivered_qty = delivered_qty + ${qty},
          last_delivered_at = ${at}::timestamptz, updated_at = ${at}::timestamptz
      WHERE id = ${lineId} AND delivered_qty = ${expected}
        AND review_status IN ('n/a', 'accepted', 'converted')
    `);
    return (result.rowCount ?? 0) > 0;
  }

  // Đủ = có dòng hiệu lực, mọi dòng hiệu lực đã giao + hủy hết, không còn dòng chờ duyệt
  async isComplete(tx: Tx, requestId: string): Promise<boolean> {
    const { rows } = await tx.execute<{ complete: boolean }>(sql`
      SELECT coalesce(
               bool_or(${EFFECTIVE_LINE})
               AND bool_and(NOT ${EFFECTIVE_LINE} OR l.delivered_qty + l.cancelled_qty = l.qty)
               AND NOT bool_or(l.review_status = 'pending'),
             false) AS complete
      FROM request_lines l WHERE l.request_id = ${requestId}
    `);
    return rows[0].complete;
  }
}
