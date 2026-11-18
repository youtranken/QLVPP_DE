import type { TFunction } from 'i18next';
import type { LineView } from './request.api';
import type { ReceiveRow } from './receive-rows';

function cancelNote(l: LineView, t: TFunction): string | null {
  if (l.cancelled_qty <= 0) return null;
  const reason = l.cancel_note?.trim();
  const base = l.cancelled_qty >= l.qty ? 'cancelledAll' : 'cancelled';
  return reason ? t(`request.history.${base}Why`, { n: l.cancelled_qty, reason }) : t(`request.history.${base}`, { n: l.cancelled_qty });
}

// Ghi chú của dòng (Adm D&E bỏ món, hủy phần còn lại) — đặt dưới tên món, cột cuối chỉ còn giờ nhận
export function noteText(row: ReceiveRow, line: LineView | undefined, t: TFunction): string {
  const cancelled = line ? cancelNote(line, t) : null;
  return [row.reason && t('request.history.removedNote', { reason: row.reason }), cancelled].filter(Boolean).join(' · ');
}
