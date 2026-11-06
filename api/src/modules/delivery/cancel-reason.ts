import { REASON_NOTE_MAX, normalizeNote } from '../requests/adjust-rules';
import { ADM_OUT_NOTE } from './adm-out-cancel';
import { cancelNoteTooLong, cancelReasonRequired } from './delivery-errors';
import type { CancelBody, CancelReason } from './delivery.dto';

const OTHER_NOTE_MIN = 3;

const LABELS: Record<CancelReason, string> = {
  adm_out_of_stock: ADM_OUT_NOTE,
  not_needed: 'Người nhận không cần nữa',
  user_left: 'Đã nghỉ việc',
  other: 'Khác',
};

// Lịch sử và chuông cũ chỉ đọc chữ cancel_note, nên lưu nhãn + ghi chú thay vì chỉ mã
export function cancelNoteOf(body: CancelBody): {
  code: CancelReason;
  note: string;
} {
  const code = body.reason_code;
  if (!code) throw cancelReasonRequired();
  const extra = normalizeNote(body.reason);
  const length = [...(extra ?? '')].length;
  if (length > REASON_NOTE_MAX) throw cancelNoteTooLong(REASON_NOTE_MAX);
  if (code === 'other' && length < OTHER_NOTE_MIN) throw cancelReasonRequired();
  return { code, note: extra ? `${LABELS[code]}: ${extra}` : LABELS[code] };
}
