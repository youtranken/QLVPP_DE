import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Executor, Tx } from '../../database/database.module';
import { ymToDate } from '../../common/period';
import {
  CUSTOM_ITEM_KEY,
  EFFECTIVE_LINE,
  OPEN_LINE_ANY_STATUS,
  REMAINING_QTY,
  UNDELIVERED_LINE,
} from './line-predicates';
import { bumpRequest } from './requests.repo';

export interface LockedLine {
  id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  item_id: string | null;
  custom_name: string | null;
  custom_unit: string | null;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  cancel_note: string | null;
  review_status: string;
}

export interface RequestHead {
  id: string;
  period_ym: string;
  user_sub: string;
}

export type OpenLine = LockedLine & { remaining: number };

export interface CancelledLine {
  id: string;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  cancel_note: string | null;
}

type CancelledRow = CancelledLine & {
  cancelled_now: number;
  note_before: string | null;
} & Record<string, unknown>;

export interface CancelOutcome {
  cancelled_now: number;
  line: CancelledLine;
  // cancel_note trước lần hủy này: hoàn tác trả về đúng chữ cũ
  note_before: string | null;
}

const CANCELLED_COLUMNS = sql.raw(
  'l.id, l.qty, l.delivered_qty, l.cancelled_qty, l.cancel_note',
);

const LINE_COLUMNS = sql`
  l.id, l.request_id, to_char(r.period_ym, 'YYYY-MM') AS period_ym, r.user_sub,
  l.item_id, l.custom_name, l.custom_unit, l.qty, l.delivered_qty, l.cancelled_qty, l.cancel_note, l.review_status
`;

// Dòng còn phần chưa giao của một khóa món trong kỳ; thứ tự theo phiếu để khóa cùng chiều lockLine
// Kiểm "còn dòng mở không" chỉ cần đếm, không kéo id về; dùng cho ADM hết hàng nên tính cả dòng món tạm ngưng
export async function openLineCount(
  ex: Executor,
  ym: string,
  key: string,
): Promise<number> {
  const { rows } = await ex.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE r.period_ym = ${ymToDate(ym)}::date AND ${OPEN_LINE_ANY_STATUS}
      AND coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) = ${key}
  `);
  return rows[0].n;
}

export async function openLineIds(
  ex: Executor,
  ym: string,
  key: string,
): Promise<string[]> {
  const { rows } = await ex.execute<{ id: string }>(sql`
    SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE r.period_ym = ${ymToDate(ym)}::date AND ${UNDELIVERED_LINE}
      AND coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) = ${key}
    ORDER BY l.request_id, l.id
  `);
  return rows.map((r) => r.id);
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
      SELECT ${LINE_COLUMNS}
      FROM request_lines l JOIN requests r ON r.id = l.request_id
      WHERE l.id = ${lineId} FOR UPDATE OF l
    `);
    return rows[0] ?? null;
  }

  // Giao nhiều dòng một phiếu: khóa phiếu rồi các dòng theo id; dòng thiếu → caller báo LINE_NOT_FOUND
  async lockRequestLines(
    tx: Tx,
    requestId: string,
    lineIds: string[],
  ): Promise<LockedLine[]> {
    const head = await tx.execute<{ id: string }>(
      sql`SELECT r.id FROM requests r WHERE r.id = ${requestId} FOR UPDATE`,
    );
    if (head.rows.length === 0) return [];
    const { rows } = await tx.execute<LockedLine & Record<string, unknown>>(sql`
      SELECT ${LINE_COLUMNS}
      FROM request_lines l JOIN requests r ON r.id = l.request_id
      WHERE l.request_id = ${requestId} AND l.id = ANY(${sql.param(lineIds)}::uuid[])
      ORDER BY l.id FOR UPDATE OF l
    `);
    return rows;
  }

  // Hủy cả phiếu: khóa phiếu rồi mọi dòng theo id; `remaining` chỉ > 0 ở dòng hiệu lực còn nợ
  async lockRequestOpenLines(
    tx: Tx,
    requestId: string,
  ): Promise<{ head: RequestHead; lines: OpenLine[] } | null> {
    const head = await tx.execute<RequestHead & Record<string, unknown>>(sql`
      SELECT r.id, to_char(r.period_ym, 'YYYY-MM') AS period_ym, r.user_sub
      FROM requests r WHERE r.id = ${requestId} FOR UPDATE
    `);
    if (head.rows.length === 0) return null;
    const { rows } = await tx.execute<OpenLine & Record<string, unknown>>(sql`
      SELECT ${LINE_COLUMNS},
        CASE WHEN ${UNDELIVERED_LINE} THEN ${REMAINING_QTY} ELSE 0 END AS remaining
      FROM request_lines l JOIN requests r ON r.id = l.request_id
      WHERE l.request_id = ${requestId}
      ORDER BY l.id FOR UPDATE OF l
    `);
    return { head: head.rows[0], lines: rows };
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
      UPDATE request_lines l
      SET delivered_qty = l.delivered_qty + ${qty},
          last_delivered_at = ${at}::timestamptz, updated_at = ${at}::timestamptz
      WHERE l.id = ${lineId} AND l.delivered_qty = ${expected} AND ${EFFECTIVE_LINE}
    `);
    return (result.rowCount ?? 0) > 0;
  }

  // Người gọi đã khóa dòng; `o` là bản trước UPDATE nên cancelled_now = đúng phần vừa hủy
  async cancelRemaining(
    tx: Tx,
    lineId: string,
    reason: string,
    now: Date,
  ): Promise<CancelOutcome> {
    const { rows } = await tx.execute<CancelledRow>(sql`
      UPDATE request_lines l
      SET cancelled_qty = l.qty - l.delivered_qty, cancel_note = ${reason},
          updated_at = ${now.toISOString()}::timestamptz
      FROM request_lines o
      WHERE l.id = ${lineId} AND o.id = l.id AND ${EFFECTIVE_LINE} AND ${REMAINING_QTY} > 0
      RETURNING ${CANCELLED_COLUMNS}, l.cancelled_qty - o.cancelled_qty AS cancelled_now,
        o.cancel_note AS note_before
    `);
    if (rows.length > 0) {
      const { cancelled_now, note_before, ...line } = rows[0];
      return { cancelled_now, line, note_before };
    }
    const current = await tx.execute<CancelledLine & Record<string, unknown>>(
      sql`SELECT ${CANCELLED_COLUMNS} FROM request_lines l WHERE l.id = ${lineId}`,
    );
    const line = current.rows[0];
    return { cancelled_now: 0, line, note_before: line.cancel_note };
  }

  // Hoàn tác hủy nợ: chỉ khi số hủy vẫn đúng bằng số lần hủy đó để lại
  async restoreCancelled(
    tx: Tx,
    lineId: string,
    to: { cancelled_qty: number; cancel_note: string | null },
    expectedCancelled: number,
    now: Date,
  ): Promise<boolean> {
    const result = await tx.execute(sql`
      UPDATE request_lines l
      SET cancelled_qty = ${to.cancelled_qty}, cancel_note = ${to.cancel_note},
          updated_at = ${now.toISOString()}::timestamptz
      WHERE l.id = ${lineId} AND l.cancelled_qty = ${expectedCancelled}
    `);
    return (result.rowCount ?? 0) > 0;
  }

  // Hoàn tác giao: lastAt = lần giao còn lại gần nhất (null nếu không còn)
  async removeDelivered(
    tx: Tx,
    lineId: string,
    qty: number,
    lastAt: Date | null,
    now: Date,
  ): Promise<boolean> {
    const result = await tx.execute(sql`
      UPDATE request_lines l
      SET delivered_qty = l.delivered_qty - ${qty},
          last_delivered_at = ${lastAt?.toISOString() ?? null}::timestamptz,
          updated_at = ${now.toISOString()}::timestamptz
      WHERE l.id = ${lineId} AND l.delivered_qty >= ${qty}
    `);
    return (result.rowCount ?? 0) > 0;
  }

  openLineIds(tx: Tx, ym: string, key: string): Promise<string[]> {
    return openLineIds(tx, ym, key);
  }

  // Dòng đổi số đã giao = phiếu đổi: tab Điều chỉnh mở với mốc cũ phải nhận STALE_UPDATE
  async touchRequest(tx: Tx, requestId: string, now: Date): Promise<string> {
    return bumpRequest(tx, requestId, now);
  }

  // Đủ = có dòng hiệu lực, mọi dòng hiệu lực đã giao + hủy hết, không còn dòng chờ duyệt
  async isComplete(tx: Tx, requestId: string): Promise<boolean> {
    const { rows } = await tx.execute<{ complete: boolean }>(sql`
      SELECT coalesce(
               bool_or(${EFFECTIVE_LINE})
               AND bool_and(NOT ${EFFECTIVE_LINE} OR ${REMAINING_QTY} = 0)
               AND NOT bool_or(l.review_status = 'pending'),
             false) AS complete
      FROM request_lines l WHERE l.request_id = ${requestId}
    `);
    return rows[0].complete;
  }
}
