import { noteLength } from '@/lib/note-text';
import type { LineView } from '@/features/request/request.api';
import type { AdjustLineBody, AdjustReason, AdminRequestView } from './summary.api';

export type Pick = { mode: 'reduce'; qty: number | null } | { mode: 'reject' };

export const OTHER_NOTE_MIN = 3;

// Phần đã giao + đã hủy nợ không giảm được (server QTY_BELOW_DELIVERED); Từ chối = về đúng sàn này
export const floorOf = (l: LineView) => l.delivered_qty + l.cancelled_qty;

// Dòng ngoài DM chờ duyệt duyệt ở Xem phiếu; dòng đã giao/hủy hết thì không còn gì để giảm
export const adjustable = (l: LineView) => l.review_status !== 'pending' && l.review_status !== 'rejected' && l.qty > floorOf(l);

// "Giảm còn n": n ≥ max(1, sàn) và n < số cũ; về sàn dùng "Từ chối"
export const reduceRange = (l: LineView) => ({ min: Math.max(1, floorOf(l)), max: l.qty - 1 });

export const canReduce = (l: LineView) => reduceRange(l).min <= reduceRange(l).max;

export type ReduceError = { kind: 'under'; min: number } | { kind: 'over'; max: number; ordered: number } | { kind: 'notInt' };

export function reduceError(l: LineView, qty: number | null): ReduceError | null {
  const r = reduceRange(l);
  if (qty === null) return { kind: 'under', min: r.min };
  if (!Number.isInteger(qty)) return { kind: 'notInt' };
  if (qty > r.max) return { kind: 'over', max: r.max, ordered: l.qty };
  return qty >= r.min ? null : { kind: 'under', min: r.min };
}

// Mỗi dòng chọn mới bắt đầu ở "Giảm còn qty − 1"; dòng không giảm được thì Từ chối
export const initialPick = (l: LineView): Pick => (canReduce(l) ? { mode: 'reduce', qty: l.qty - 1 } : { mode: 'reject' });

export const targetOf = (l: LineView, p: Pick) => (p.mode === 'reject' ? floorOf(l) : (p.qty ?? l.qty));

export const otherNoteMissing = (reason: AdjustReason | undefined, note: string) => reason === 'other' && noteLength(note) < OTHER_NOTE_MIN;

// Server đòi mọi dòng kèm expected_qty; chỉ dòng được chọn đổi số và mang lý do chung
export function adjustBody(view: AdminRequestView, picks: Record<string, Pick>, reason: AdjustReason, note: string) {
  const clean = note.normalize('NFC').trim();
  const lines = view.lines.map((l): AdjustLineBody => {
    const p = picks[l.id];
    if (!p) return { id: l.id, qty: l.qty, expected_qty: l.qty };
    return { id: l.id, qty: targetOf(l, p), expected_qty: l.qty, reason_code: reason, ...(clean ? { reason_note: clean } : {}) };
  });
  return { lines, expected_updated_at: view.updated_at };
}
