import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { ymToDate } from '../../common/period';

// Dòng hiệu lực (cần mua/giao) của bảng request_lines bí danh `l`; pending/rejected không tính
export const EFFECTIVE_LINE = sql.raw(
  `l.review_status IN ('n/a', 'accepted', 'converted')`,
);
// Định nghĩa duy nhất "phần còn lại" phía SQL; remainingOf (delivery) là bản TS của cùng công thức
export const REMAINING_QTY = sql.raw(
  '(l.qty - l.delivered_qty - l.cancelled_qty)',
);
export const UNDELIVERED_LINE = sql`(${EFFECTIVE_LINE} AND ${REMAINING_QTY} > 0)`;
// Khóa gộp món ngoài DM (tên + ĐVT đã trim, không phân biệt hoa thường) dùng chung Tổng hợp/Còn nợ/báo cáo; mảng jsonb để không ký tự phân cách nào gây trùng khóa
export const CUSTOM_ITEM_KEY = sql.raw(
  `('custom:' || jsonb_build_array(lower(trim(l.custom_name)), lower(trim(l.custom_unit)))::text)`,
);
// Kỳ đã khóa của phiếu bí danh `r`; openYm lấy từ ClockService (không now() của Postgres)
export const lockedPeriod = (openYm: string): SQL =>
  sql`r.period_ym < ${ymToDate(openYm)}::date`;
