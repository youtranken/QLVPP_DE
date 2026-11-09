import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { cutNote, noteLength } from '@/lib/note-text';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import type { LineView } from '@/features/request/request.api';
import { REVIEW_KEY, reviewLine, type ReviewResult } from '@/features/review/review.api';
import { isStaleReview, reviewErrorKey } from '@/features/review/review-errors';
import { useSendState } from '@/features/send-adm/use-send-state';
import { useRefreshAfterLineChange } from '@/features/delivery/people/use-refresh-after-flow';
import { defaultReason, isOverMax, reasonChoices, removedReason, type LineReason } from './adjust-reasons';
import { adjustFailure, isStaleUpdate, type AdjustErrors } from './summary-errors';
import { adminRequestKey, saveAdjust, useAdminRequest, type AdjustBody, type AdjustLineBody, type AdjustReason, type AdminRequestView } from './summary.api';

interface Draft {
  qty: Record<string, number>;
  removed: string[];
  reasons: Record<string, LineReason>;
  errors: AdjustErrors;
  stale: boolean;
  reloaded: boolean;
}

const EMPTY: Draft = { qty: {}, removed: [], reasons: {}, errors: {}, stale: false, reloaded: false };

export const NOTE_MAX = 200;
export const OTHER_NOTE_MIN = 3;
// Server đếm ghi chú theo mã điểm sau NFC + trim
const clean = (note: string) => note.normalize('NFC').trim();

// Bỏ dòng (qty 0) hợp lệ khi chưa giao, chưa hủy nợ — bất kể trạng thái duyệt
export const canRemove = (l: LineView) => l.delivered_qty + l.cancelled_qty === 0;

// Không giảm dưới phần đã giao + đã hủy nợ (QTY_BELOW_DELIVERED); ô số luôn ≥ 1, về 0 bằng nút Bỏ
export const floorOf = (l: LineView) => Math.max(1, l.delivered_qty + l.cancelled_qty);

export { isOverMax, type LineReason };

export const reasonComplete = (r: LineReason) => !!r.code && (r.code !== 'other' || noteLength(r.note) >= OTHER_NOTE_MIN);

const FACTS = ['qty', 'delivered_qty', 'cancelled_qty', 'review_status', 'item_id'] as const;

function othersChanged(before: LineView[], after: LineView[], skip: string): boolean {
  const others = (ls: LineView[]) => ls.filter((l) => l.id !== skip);
  const prev = new Map(others(before).map((l) => [l.id, l]));
  const next = others(after);
  return next.length !== prev.size || next.some((l) => !prev.has(l.id) || FACTS.some((k) => prev.get(l.id)![k] !== l[k]));
}

const withoutError = (d: Draft, key: string): Draft =>
  d.errors.lines?.[key] ? { ...d, errors: { ...d.errors, lines: { ...d.errors.lines, [key]: '' } } } : d;

function useDraft(requestId: string) {
  // Nháp gắn với phiếu: ↑/↓ đổi phiếu thì nháp cũ tự bỏ, không cần dựng lại ngăn kéo
  const [state, setState] = useState({ id: requestId, d: EMPTY });
  const draft = state.id === requestId ? state.d : EMPTY;
  const patch = (fn: (d: Draft) => Draft) => setState((s) => ({ id: requestId, d: fn(s.id === requestId ? s.d : EMPTY) }));
  const edit = {
    setQty: (id: string, n: number) => patch((d) => withoutError({ ...d, qty: { ...d.qty, [id]: n } }, id)),
    remove: (id: string) => patch((d) => ({ ...d, removed: [...d.removed, id] })),
    restore: (id: string) => patch((d) => ({ ...d, removed: d.removed.filter((x) => x !== id) })),
    setReason: (id: string, r: LineReason) => patch((d) => withoutError({ ...d, reasons: { ...d.reasons, [id]: { ...r, note: cutNote(r.note, NOTE_MAX) } } }, id)),
    // "Dùng cho các món giảm còn lại": chỉ điền dòng giảm chưa chọn lý do, không ghi đè
    fillReasons: (ids: string[], r: LineReason) =>
      patch((d) => ({ ...d, reasons: { ...d.reasons, ...Object.fromEntries(ids.map((id) => [id, { ...r }])) } })),
  };
  // Bản mới thay bản cũ nên số đã sửa không còn đúng chỗ; nháp lý do theo dòng vẫn dùng lại được
  const restart = (mark: Partial<Pick<Draft, 'stale' | 'reloaded'>> = {}) => patch((d) => ({ ...EMPTY, reasons: d.reasons, ...mark }));
  return { draft, patch, edit, restart };
}

type Patch = (fn: (d: Draft) => Draft) => void;

const qtyIn = (d: Draft) => (l: LineView) => (d.removed.includes(l.id) ? 0 : (d.qty[l.id] ?? l.qty));

type Translate = (key: string, opts?: Record<string, unknown>) => string;

// Lý do đang hiệu lực của dòng: dòng bấm X bỏ → "removed" (hoặc lý do chọn sẵn); nháp đã chọn, không thì chọn sẵn
// (mở từ ?left=1 → Người đã nghỉ; vượt tối đa → Khác + ghi chú)
const reasonIn = (d: Draft, preset: AdjustReason | undefined, t: Translate) => (l: LineView): LineReason =>
  d.removed.includes(l.id) ? removedReason(preset) : (d.reasons[l.id] ?? defaultReason(l, preset, t));

// Dòng ngoài DM chờ duyệt: mặc định mua lần này (Lưu duyệt "accept"), bấm X → "Không mua" (reject)
const isPending = (l: LineView) => l.review_status === 'pending';

// Server đòi mọi dòng kèm expected_qty; bỏ dòng = qty 0; chỉ dòng giảm mang lý do (nháp của dòng không giảm không gửi)
function bodyOf(current: AdminRequestView, d: Draft, preset: AdjustReason | undefined, t: Translate) {
  const reasonOf = reasonIn(d, preset, t);
  const lineOf = (l: LineView): AdjustLineBody => {
    const qty = qtyIn(d)(l);
    if (qty >= l.qty) return { id: l.id, qty, expected_qty: l.qty };
    const r = reasonOf(l);
    const note = clean(r.note);
    return { id: l.id, qty, expected_qty: l.qty, reason_code: r.code, ...(note ? { reason_note: note } : {}) };
  };
  const body: AdjustBody = { lines: current.lines.map(lineOf), expected_updated_at: current.updated_at };
  return { body, keys: current.lines.map((l) => l.id) };
}

// Giảm phiếu đổi phần đang giữ ở Tủ, Gửi ADM (W6/W15), Hàng về (W14), Còn nợ; bỏ/sửa dòng ngoài DM đổi hàng chờ của Món ngoài danh mục
export function useRefreshAfterAdjust() {
  return useRefreshAfterLineChange([REVIEW_KEY]);
}

function useSendAdjust(requestId: string, patch: Patch, onDone: () => void, sync: { reviewed: (r: ReviewResult) => void; reviewStale: (lineId: string) => Promise<void> }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshAfterAdjust();
  const toast = useToast();
  // Duyệt tuần tự dòng chờ duyệt trước khi lưu số: lỗi thì dừng, báo ở dòng; trả bản phiếu đã vá updated_at
  const settlePending = async (current: AdminRequestView, d: Draft): Promise<AdminRequestView | null> => {
    let view = current;
    for (const l of current.lines.filter(isPending)) {
      const drop = d.removed.includes(l.id);
      try {
        const r = await reviewLine(l.id, drop ? { action: 'reject', note: t('summary.adjust.removedNote') } : { action: 'accept' }, csrfToken);
        sync.reviewed(r);
        view = { ...view, updated_at: r.request_updated_at, lines: view.lines.map((x) => (x.id === r.line.id ? r.line : x)) };
        // Đã "Không mua" thì dòng không còn bỏ bằng số nữa
        if (drop) patch((x) => ({ ...x, removed: x.removed.filter((id) => id !== l.id) }));
      } catch (e) {
        patch((x) => ({ ...x, errors: { lines: { [l.id]: t(reviewErrorKey(e) ?? 'review.errors.UNKNOWN') } } }));
        if (isStaleReview(e)) void sync.reviewStale(l.id);
        return null;
      }
    }
    return view;
  };
  return async (current: AdminRequestView, d: Draft, preset: AdjustReason | undefined) => {
    patch((x) => ({ ...x, errors: {} }));
    const reviewing = current.lines.some(isPending);
    const view = await settlePending(current, d);
    if (!view) {
      if (reviewing) void refresh();
      return;
    }
    const rejected = new Set(current.lines.filter((l) => isPending(l) && d.removed.includes(l.id)).map((l) => l.id));
    const { body, keys } = bodyOf(view, { ...d, removed: d.removed.filter((id) => !rejected.has(id)) }, preset, t);
    try {
      await saveAdjust(requestId, body, csrfToken);
      void refresh();
      toast.show({ text: t('summary.adjust.saved', { name: current.full_name ?? current.user_sub }), tone: 'ok' });
      onDone();
    } catch (e) {
      if (reviewing) void refresh();
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

// Bản có hàng đã gửi ADM của kỳ: giảm sau mốc này thì hàng về dư vào kho
function useSentAt(view: AdminRequestView | undefined) {
  const send = useSendState(view?.period_ym ?? '', !!view && !view.is_open);
  return send.state === 'sent' ? (send.sent?.created_at ?? null) : null;
}

export function useAdjust(requestId: string, onDone: () => void, presetAsked?: AdjustReason) {
  const { t } = useTranslation();
  const flight = useSingleFlight();
  const { draft: d, patch, edit, restart } = useDraft(requestId);
  const sync = useReviewSync(requestId, restart);
  const send = useSendAdjust(requestId, patch, onDone, sync);
  const view = sync.query.data;
  // Lý do chọn sẵn (từ ?left=1) chỉ áp cho phiếu của người đã nghỉ thật
  const ownerLeft = !!view && view.user_status !== 'active';
  const preset = ownerLeft ? presetAsked : undefined;
  const sentAt = useSentAt(view);
  const qtyOf = qtyIn(d);
  const reasonOf = reasonIn(d, preset, t);
  // Theo thứ tự hiển thị: dòng trong danh mục trước, dòng từng là ngoài DM sau
  const all = view?.lines ?? [];
  const lines = [...all.filter((l) => l.review_status === 'n/a'), ...all.filter((l) => l.review_status !== 'n/a')];
  // Dòng bấm X tự mang lý do "removed": không đòi chọn lý do, không làm nguồn "Dùng cho các món giảm còn lại"
  const reduced = lines.filter((l) => qtyOf(l) < l.qty && !d.removed.includes(l.id));
  const missing = reduced.filter((l) => !reasonComplete(reasonOf(l)));
  const changes = d.removed.length + lines.filter((l) => !d.removed.includes(l.id) && qtyOf(l) !== l.qty).length;
  // Dòng chờ duyệt còn giữ: Lưu duyệt "mua lần này" nên Lưu bật được dù chưa đổi số (chân ngăn, hỏi bỏ nháp vẫn chỉ tính sửa của người dùng)
  const pendingKept = lines.filter((l) => isPending(l) && !d.removed.includes(l.id)).length;
  const canSave = changes + pendingKept > 0 && missing.length === 0 && !d.stale && !flight.pending;
  // "Dùng cho các món giảm còn lại": ở dòng giảm đầu tiên đã đủ lý do, khi còn dòng giảm chưa chọn lý do
  const source = reduced.find((l) => reasonComplete(reasonOf(l)));
  const blank = reduced.filter((l) => !reasonOf(l).code);
  return {
    query: sync.query,
    view,
    qtyOf,
    reasonOf,
    choices: reasonChoices({ ownerLeft }),
    isReduced: (l: LineView) => qtyOf(l) < l.qty,
    removed: d.removed,
    edit,
    sentAt,
    missing: missing.length,
    reuseFrom: source && blank.length > 0 ? source.id : null,
    reuse: () => {
      if (source) edit.fillReasons(blank.map((l) => l.id), reasonOf(source));
    },
    errors: d.errors,
    stale: d.stale,
    reloaded: d.reloaded,
    saving: flight.pending,
    changes,
    canSave,
    dirty: changes > 0,
    reviewed: sync.reviewed,
    reload: () => void sync.query.refetch(),
    reloadLatest: () => void sync.reloadLatest(),
    reviewStale: (lineId: string) => void sync.reviewStale(lineId),
    save: () => void flight.run(async () => {
      if (view && canSave) await send(view, d, preset);
    }),
  };
}

export type Adjust = ReturnType<typeof useAdjust>;
