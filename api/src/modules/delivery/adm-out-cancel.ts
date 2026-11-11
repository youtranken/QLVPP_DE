import { ConflictException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Executor } from '../../database/database.module';
import type {
  CancelledLine,
  LockedLine,
} from '../requests/line-delivery.store';
import { CUSTOM_ITEM_KEY } from '../requests/line-predicates';

// Chữ hiện cho người dùng (lý do hủy, Lịch sử); dòng cũ trong DB giữ chữ lúc ghi
export const ADM_OUT_NOTE = 'NCC hết hàng';
export const ADM_OUT_REASON = 'adm_out_of_stock';

export const itemNotAdmOut = () =>
  new ConflictException({
    code: 'ITEM_NOT_ADM_OUT',
    message: 'Món của dòng này chưa đánh "NCC hết hàng" cho kỳ của dòng.',
  });

// Đánh dấu theo kỳ của chính dòng: dòng nợ kỳ khác cùng món không bị ảnh hưởng.
// FOR SHARE trước khi khóa dòng, cùng chiều bỏ dấu/tự hủy (period_adm_out → requests → request_lines): bỏ dấu đang chạy thì chờ rồi đọc lại
export async function lockLineAdmOut(
  ex: Executor,
  lineId: string,
): Promise<boolean> {
  const { rows } = await ex.execute(sql`
    SELECT 1 FROM period_adm_out a
    JOIN requests r ON r.period_ym = a.period_ym
    JOIN request_lines l ON l.request_id = r.id
    WHERE l.id = ${lineId} AND a.kind = 'out'
      AND a.line_key = coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY})
    FOR SHARE OF a`);
  return rows.length > 0;
}

// `at` theo ClockService: chuông ngày gộp đọc lại các lần hủy này theo ngày giờ VN
export function admOutCancelDetail(
  line: LockedLine,
  result: { cancelled_now: number; line: CancelledLine },
  now: Date,
): Record<string, unknown> {
  return {
    request_id: line.request_id,
    before: { cancelled_qty: line.cancelled_qty },
    after: { cancelled_qty: result.line.cancelled_qty },
    reason: ADM_OUT_NOTE,
    reason_code: ADM_OUT_REASON,
    cancelled_now: result.cancelled_now,
    at: now.toISOString(),
  };
}
