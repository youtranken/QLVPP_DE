import { sql } from 'drizzle-orm';
import {
  REMAINING_QTY,
  UNDELIVERED_LINE,
  lockedPeriod,
} from '../requests/line-predicates';

// Phần còn lại của dòng kỳ khóa (Chưa nhận + Còn nợ) theo món; kỳ mở không giữ gì
export function heldSql(openYm: string) {
  return sql`
    SELECT l.item_id, sum(${REMAINING_QTY})::int AS held,
           count(DISTINCT r.user_sub)::int AS waiting
    FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE l.item_id IS NOT NULL AND ${UNDELIVERED_LINE} AND ${lockedPeriod(openYm)}
    GROUP BY l.item_id`;
}
