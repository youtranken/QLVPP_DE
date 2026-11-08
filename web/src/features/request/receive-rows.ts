import type { TFunction } from 'i18next';
import { adjustReasonText } from '@/lib/adjust-reason';
import type { LineView, RequestView } from './request.api';
import { nameIn } from './request-format';

export type ReceiveState = 'received' | 'waiting' | 'none';

export interface ReceiveRow {
  id: string;
  name: string;
  // Mã ĐVT thô (hiển thị qua useRequestFormat().unit)
  unit: string | null;
  registered: number;
  toGive: number;
  received: number;
  state: ReceiveState;
  waiting: number;
  note: string | null;
  // Lý do Hành chính bỏ món (chỉ hàng đã bỏ)
  reason: string | null;
  receivedAt: string | null;
}

// Dòng còn chờ Hành chính xem / bị từ chối không giao nên không có hàng trong bảng nhận
const skipped = (l: LineView) => l.review_status === 'pending' || l.review_status === 'rejected';

function lineRow(l: LineView, lang: string): ReceiveRow {
  const toGive = l.qty - l.cancelled_qty;
  const received = l.delivered_qty;
  const state: ReceiveState = toGive <= 0 ? 'none' : received >= toGive ? 'received' : 'waiting';
  return {
    id: l.id,
    name: l.item ? nameIn(l.item, lang) : (l.custom_name ?? ''),
    unit: l.item?.unit ?? l.custom_unit,
    registered: l.adjustments?.[0]?.before ?? l.qty,
    toGive: Math.max(toGive, 0),
    received,
    state,
    waiting: state === 'waiting' ? toGive - received : 0,
    note: null,
    reason: null,
    receivedAt: l.last_delivered_at,
  };
}

// Bảng nhận hàng của một phiếu đã khóa: đăng ký (số gốc) → được giao → đã nhận; món Hành chính bỏ thành "Không giao"
export function receiveRows(view: RequestView, t: TFunction, lang: string): ReceiveRow[] {
  const rows = view.lines.filter((l) => !skipped(l)).map((l) => lineRow(l, lang));
  const removed = (view.removed_lines ?? []).map<ReceiveRow>((r) => {
    const reason = adjustReasonText(t, r.reason_code, r.reason_note);
    return {
      id: `removed-${r.at}-${r.name}`,
      name: nameIn(r, lang),
      unit: r.unit,
      registered: r.before,
      toGive: 0,
      received: 0,
      state: 'none',
      waiting: 0,
      note: t('request.receive.removed', { reason }),
      reason,
      receivedAt: null,
    };
  });
  return [...rows, ...removed];
}

export function receiveSummary(rows: ReceiveRow[]): { done: number; total: number; waiting: number } {
  const given = rows.filter((r) => r.toGive > 0);
  const done = given.filter((r) => r.state === 'received').length;
  return { done, total: given.length, waiting: given.length - done };
}
