import { ConflictException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Executor } from '../../database/database.module';
import type {
  CancelledLine,
  LockedLine,
} from '../requests/line-delivery.store';
import { CUSTOM_ITEM_KEY } from '../requests/line-predicates';

export const ADM_OUT_NOTE = 'ADM hết hàng';
export const ADM_OUT_REASON = 'adm_out_of_stock';

export const itemNotAdmOut = () =>
  new ConflictException({
    code: 'ITEM_NOT_ADM_OUT',
    message: 'Món của dòng này chưa đánh "ADM hết hàng" cho kỳ của dòng.',
  });

// Đánh dấu theo kỳ của chính dòng: dòng nợ kỳ khác cùng món không bị ảnh hưởng
export async function lineIsAdmOut(
  ex: Executor,
  lineId: string,
): Promise<boolean> {
  const { rows } = await ex.execute<{ out: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM period_adm_out a
      WHERE a.period_ym = r.period_ym AND a.kind = 'out'
        AND a.line_key = coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY})
    ) AS out
    FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE l.id = ${lineId}`);
  return rows[0]?.out ?? false;
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
