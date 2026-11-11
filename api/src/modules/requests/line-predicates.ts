import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { ymToDate } from '../../common/period';

// Dòng của món đang tạm ngưng (món hoặc nhóm active=false) và chưa giao gì; bật lại món thì tính lại ngay.
// Subquery tương quan chỉ dùng bí danh `l` nên nơi dùng không phải JOIN thêm items/item_categories
const SUSPENDED_LINE_SQL = `(l.item_id IS NOT NULL AND l.delivered_qty = 0 AND EXISTS (
  SELECT 1 FROM items si LEFT JOIN item_categories sc ON sc.id = si.category_id
  WHERE si.id = l.item_id AND NOT (si.active AND coalesce(sc.active, true))))`;
export const SUSPENDED_LINE = sql.raw(SUSPENDED_LINE_SQL);
// Dòng hiệu lực (cần mua/giao) của bảng request_lines bí danh `l`: pending/rejected không tính,
// dòng món tạm ngưng chưa giao cũng không tính (đã giao một phần thì vẫn tính để giữ lịch sử giao)
export const EFFECTIVE_LINE = sql.raw(
  `(l.review_status IN ('n/a', 'accepted', 'converted') AND NOT ${SUSPENDED_LINE_SQL})`,
);
// Dòng món trong danh mục từ đầu (không phải món ngoài DM, kể cả đã duyệt/đã thêm vào DM) và không tạm ngưng:
// Lịch sử nhân viên chỉ đếm số món/đơn vị/tình trạng giao trên các dòng này, món ngoài DM ghi dòng riêng
export const CATALOG_LINE = sql.raw(
  `(l.review_status = 'n/a' AND NOT ${SUSPENDED_LINE_SQL})`,
);
// Định nghĩa duy nhất "phần còn lại" phía SQL; remainingOf (delivery) là bản TS của cùng công thức
export const REMAINING_QTY = sql.raw(
  '(l.qty - l.delivered_qty - l.cancelled_qty)',
);
export const UNDELIVERED_LINE = sql`(${EFFECTIVE_LINE} AND ${REMAINING_QTY} > 0)`;
// Dòng còn mở KHÔNG xét tạm ngưng: chỉ cho kiểm "ADM hết hàng" (đánh/bỏ dấu, chốt) để món đánh dấu rồi tạm ngưng không bị kẹt
export const OPEN_LINE_ANY_STATUS = sql`(l.review_status IN ('n/a', 'accepted', 'converted') AND ${REMAINING_QTY} > 0)`;
// Còn nợ = phần chưa giao của kỳ trước tháng đang giao; phần còn lại của chính tháng đó là "Chưa nhận"
export const DEBT_LINE_SQL = (latestLockedYm: string): SQL =>
  sql`(${UNDELIVERED_LINE} AND r.period_ym < ${ymToDate(latestLockedYm)}::date)`;
// Khóa gộp món ngoài DM (tên + ĐVT đã trim, không phân biệt hoa thường) dùng chung Tổng hợp/Còn nợ/báo cáo; mảng jsonb để không ký tự phân cách nào gây trùng khóa
export const CUSTOM_ITEM_KEY = sql.raw(
  `('custom:' || jsonb_build_array(lower(trim(l.custom_name)), lower(trim(l.custom_unit)))::text)`,
);
// Kỳ đã khóa của phiếu bí danh `r`; openYm lấy từ ClockService (không now() của Postgres)
export const lockedPeriod = (openYm: string): SQL =>
  sql`r.period_ym < ${ymToDate(openYm)}::date`;
