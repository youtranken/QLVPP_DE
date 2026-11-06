import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import type { LineView } from '@/features/request/request.api';
import { REVIEW_KEY, type ReviewResult } from '@/features/review/review.api';
import { adjustFailure, isStaleUpdate, type AdjustErrors } from './summary-errors';
import { SUMMARY_KEY, adminRequestKey, saveAdjust, useAdminRequest, type AdjustBody, type AdjustLineBody, type AdminRequestView } from './summary.api';

export interface AddedLine {
  key: string;
  item_id: string;
  qty: number;
}

interface Draft {
  qty: Record<string, number>;
  removed: string[];
  added: AddedLine[];
  reason: string;
  errors: AdjustErrors;
  stale: boolean;
  reloaded: boolean;
}

const EMPTY: Draft = { qty: {}, removed: [], added: [], reason: '', errors: {}, stale: false, reloaded: false };

// Cùng luật isDeletable của api ở chế độ Hành chính: chưa giao, chưa duyệt
export const canRemove = (l: LineView) =>
  l.delivered_qty === 0 && (l.review_status === 'n/a' || l.review_status === 'pending');

// Không giảm dưới phần đã giao + đã hủy nợ (QTY_BELOW_DELIVERED); qty luôn ≥ 1
export const floorOf = (l: LineView) => Math.max(1, l.delivered_qty + l.cancelled_qty);

const FACTS = ['qty', 'delivered_qty', 'cancelled_qty', 'review_status', 'item_id'] as const;

function othersChanged(before: LineView[], after: LineView[], skip: string): boolean {
  const others = (ls: LineView[]) => ls.filter((l) => l.id !== skip);
  const prev = new Map(others(before).map((l) => [l.id, l]));
  const next = others(after);
  return next.length !== prev.size || next.some((l) => !prev.has(l.id) || FACTS.some((k) => prev.get(l.id)![k] !== l[k]));
}

const withoutError = (d: Draft, key: string): Draft =>
  d.errors.lines?.[key] ? { ...d, errors: { ...d.errors, lines: { ...d.errors.lines, [key]: '' } } } : d;

let addedSeq = 0;

function useDraft(requestId: string) {
  // Nháp gắn với phiếu: ↑/↓ đổi phiếu thì nháp cũ tự bỏ, không cần dựng lại ngăn kéo
  const [state, setState] = useState({ id: requestId, d: EMPTY });
  const draft = state.id === requestId ? state.d : EMPTY;
  const patch = (fn: (d: Draft) => Draft) => setState((s) => ({ id: requestId, d: fn(s.id === requestId ? s.d : EMPTY) }));
  const edit = {
    setQty: (id: string, n: number) => patch((d) => withoutError({ ...d, qty: { ...d.qty, [id]: n } }, id)),
    remove: (id: string) => patch((d) => ({ ...d, removed: [...d.removed, id] })),
    restore: (id: string) => patch((d) => ({ ...d, removed: d.removed.filter((x) => x !== id) })),
    add: (itemId: string) => patch((d) => ({ ...d, added: [...d.added, { key: `new-${++addedSeq}`, item_id: itemId, qty: 1 }] })),
    setAddedQty: (key: string, n: number) =>
      patch((d) => withoutError({ ...d, added: d.added.map((x) => (x.key === key ? { ...x, qty: n } : x)) }, key)),
    dropAdded: (key: string) => patch((d) => ({ ...d, added: d.added.filter((x) => x.key !== key) })),
  };
  // Bản mới thay bản cũ nên số đã sửa không còn đúng chỗ; lý do vẫn dùng lại được
  const restart = (mark: Partial<Pick<Draft, 'stale' | 'reloaded'>> = {}) => patch((d) => ({ ...EMPTY, reason: d.reason, ...mark }));
  return { draft, patch, edit, restart };
}

type Patch = (fn: (d: Draft) => Draft) => void;

const qtyIn = (d: Draft) => (l: LineView) => d.qty[l.id] ?? l.qty;

const NOTE_MAX = 200;
// Server đếm ghi chú theo mã điểm sau NFC + trim
const noteOf = (reason: string) => [...reason.normalize('NFC').trim()].slice(0, NOTE_MAX).join('').trim();

// Server đòi mọi dòng kèm expected_qty; bỏ dòng = qty 0; dòng giảm mang lý do chung dưới mã "Khác" tới khi có chọn lý do từng dòng
function bodyOf(current: AdminRequestView, d: Draft) {
  const note = noteOf(d.reason);
  const lineOf = (l: LineView): AdjustLineBody => {
    const qty = d.removed.includes(l.id) ? 0 : qtyIn(d)(l);
    const reduced = qty < l.qty ? { reason_code: 'other' as const, ...(note ? { reason_note: note } : {}) } : {};
    return { id: l.id, qty, expected_qty: l.qty, ...reduced };
  };
  const body: AdjustBody = {
    lines: [...current.lines.map(lineOf), ...d.added.map((a) => ({ item_id: a.item_id, qty: a.qty }))],
    expected_updated_at: current.updated_at,
  };
  return { body, keys: [...current.lines.map((l) => l.id), ...d.added.map((a) => a.key)] };
}

function useSendAdjust(requestId: string, patch: Patch, onDone: () => void) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  return async (current: AdminRequestView, d: Draft) => {
    const { body, keys } = bodyOf(current, d);
    patch((x) => ({ ...x, errors: {} }));
    try {
      const res = await saveAdjust(requestId, body, csrfToken);
      void qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      // Bỏ/sửa dòng ngoài DM đang chờ đổi hàng chờ của trang Món ngoài danh mục
      void qc.invalidateQueries({ queryKey: REVIEW_KEY });
      const name = current.full_name ?? current.user_sub;
      toast.show({ text: t(res.request ? 'summary.adjust.saved' : 'summary.adjust.dropped', { name }), tone: 'ok' });
      onDone();
    } catch (e) {
      patch((x) => (isStaleUpdate(e) ? { ...x, stale: true } : { ...x, errors: adjustFailure(e, keys, t) }));
    }
  };
}

function useReviewSync(requestId: string, restart: (mark?: Partial<Pick<Draft, 'stale' | 'reloaded'>>) => void) {
  const qc = useQueryClient();
  const query = useAdminRequest(requestId);
  // Review đổi updated_at của phiếu: vá bản đang xem để lần Lưu sau không bị STALE oan
  const reviewed = (r: ReviewResult) =>
    qc.setQueryData<AdminRequestView>(adminRequestKey(requestId), (v) =>
      v && { ...v, updated_at: r.request_updated_at, lines: v.lines.map((l) => (l.id === r.line.id ? r.line : l)) },
    );
  // Review thua đua: đã tải bản mới; nhân viên đổi dòng khác thì nháp không còn đúng chỗ → bỏ nháp, chỉ báo (không chặn Lưu)
  const reviewStale = async (lineId: string) => {
    const before = query.data?.lines ?? [];
    const { data } = await query.refetch();
    if (data && othersChanged(before, data.lines, lineId)) restart({ reloaded: true });
  };
  const reloadLatest = async () => {
    await query.refetch();
    restart();
  };
  return { query, reviewed, reviewStale, reloadLatest };
}

export function useAdjust(requestId: string, onDone: () => void) {
  const flight = useSingleFlight();
  const { draft: d, patch, edit, restart } = useDraft(requestId);
  const sync = useReviewSync(requestId, restart);
  const send = useSendAdjust(requestId, patch, onDone);
  const view = sync.query.data;
  const qtyOf = qtyIn(d);
  const changes =
    d.removed.length + d.added.length + (view?.lines ?? []).filter((l) => !d.removed.includes(l.id) && qtyOf(l) !== l.qty).length;
  const canSave = changes > 0 && !d.stale && !flight.pending;
  return {
    query: sync.query,
    view,
    qtyOf,
    removed: d.removed,
    added: d.added,
    edit,
    reason: d.reason,
    setReason: (v: string) => patch((x) => ({ ...x, reason: v, errors: { ...x.errors, reason: undefined } })),
    errors: d.errors,
    stale: d.stale,
    reloaded: d.reloaded,
    saving: flight.pending,
    locked: view ? !view.is_open : false,
    changes,
    canSave,
    dirty: changes > 0 || d.reason.trim() !== '',
    reviewed: sync.reviewed,
    reload: () => void sync.query.refetch(),
    reloadLatest: () => void sync.reloadLatest(),
    reviewStale: (lineId: string) => void sync.reviewStale(lineId),
    save: () => void flight.run(async () => {
      if (view && canSave) await send(view, d);
    }),
  };
}

export type Adjust = ReturnType<typeof useAdjust>;
