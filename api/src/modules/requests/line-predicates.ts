import { sql } from 'drizzle-orm';

// Dòng hiệu lực (cần mua/giao) của bảng request_lines bí danh `l`; pending/rejected không tính
export const EFFECTIVE_LINE = sql.raw(
  `l.review_status IN ('n/a', 'accepted', 'converted')`,
);
// Định nghĩa duy nhất "phần còn lại" phía SQL; remainingOf (delivery) là bản TS của cùng công thức
export const REMAINING_QTY = sql.raw(
  '(l.qty - l.delivered_qty - l.cancelled_qty)',
);
export const UNDELIVERED_LINE = sql`(${EFFECTIVE_LINE} AND ${REMAINING_QTY} > 0)`;
