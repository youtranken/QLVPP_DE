import { sql } from 'drizzle-orm';

// Dòng hiệu lực (cần mua/giao) của bảng request_lines bí danh `l`; pending/rejected không tính
export const EFFECTIVE_LINE = sql.raw(
  `l.review_status IN ('n/a', 'accepted', 'converted')`,
);
export const UNDELIVERED_LINE = sql`(${EFFECTIVE_LINE} AND l.delivered_qty + l.cancelled_qty < l.qty)`;
