import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorNumber, apiErrorString } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import type { LineView } from '@/features/request/request.api';
import type { ReviewResult } from '@/features/review/review.api';
import { SUMMARY_KEY, adminRequestKey, saveAdjust, useAdminRequest, type AdjustBody, type AdminRequestView } from './summary.api';

export interface AddedLine {
  key: string;
  item_id: string;
  qty: number;
}

export interface AdjustErrors {
  lines?: Record<string, string>;
  reason?: string;
  form?: string;
}

type T = (key: string, opts?: Record<string, unknown>) => string;

const REASON_MIN = 3;
const LINE_CODES = new Set([
  'QTY_BELOW_DELIVERED',
  'QTY_INVALID',
  'QTY_EXCEEDS_MAX',
  'ITEM_INACTIVE',
  'ITEM_NOT_FOUND',
  'ADMIN_ONLY_ITEM',
  'DUPLICATE_ITEM',
  'LINE_NOT_FOUND',
]);

// Cùng luật isDeletable của api ở chế độ Hành chính: chưa giao, chưa duyệt
export const canRemove = (l: LineView) =>
  l.delivered_qty === 0 && (l.review_status === 'n/a' || l.review_status === 'pending');

// Không giảm dưới phần đã giao + đã hủy nợ (QTY_BELOW_DELIVERED); qty luôn ≥ 1
export const floorOf = (l: LineView) => Math.max(1, l.delivered_qty + l.cancelled_qty);

// Dòng mới chưa có id → server trỏ bằng line_index = vị trí trong body
function failureOf(e: unknown, keys: string[], t: T): AdjustErrors {
  const code = apiErrorCode(e) ?? '';
  if (code === 'REASON_REQUIRED') return { reason: t('summary.adjust.errors.REASON_REQUIRED') };
  const index = apiErrorNumber(e, 'line_index');
  const id = apiErrorString(e, 'line_id');
  const key = index !== undefined ? keys[index] : id && keys.includes(id) ? id : undefined;
  if (key) {
    const msg = t(`summary.adjust.errors.line.${LINE_CODES.has(code) ? code : 'OTHER'}`, {
      max: apiErrorNumber(e, 'max'),
      delivered: apiErrorNumber(e, 'delivered'),
    });
    return { lines: { [key]: msg } };
  }
  const known = code === 'REQUEST_NOT_FOUND' || code === 'DUPLICATE_ITEM';
  return { form: t(`summary.adjust.errors.${known ? code : 'UNKNOWN'}`) };
}

const FACTS = ['qty', 'delivered_qty', 'cancelled_qty', 'review_status', 'item_id'] as const;

function othersChanged(before: LineView[], after: LineView[], skip: string): boolean {
  const others = (ls: LineView[]) => ls.filter((l) => l.id !== skip);
  const prev = new Map(others(before).map((l) => [l.id, l]));
  const next = others(after);
  return next.length !== prev.size || next.some((l) => !prev.has(l.id) || FACTS.some((k) => prev.get(l.id)![k] !== l[k]));
}

let addedSeq = 0;

export function useAdjust(requestId: string, onSaved: () => void) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const query = useAdminRequest(requestId);
  const view = query.data;
  const [qty, setQty] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<AddedLine[]>([]);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<AdjustErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const qtyOf = (l: LineView) => qty[l.id] ?? l.qty;
  const lines = view?.lines ?? [];
  const changed =
    removed.length > 0 || added.length > 0 || lines.some((l) => qtyOf(l) !== l.qty);
  const locked = view ? !view.is_open : false;
  const reasonOk = !locked || reason.trim().length >= REASON_MIN;
  const clearError = (key: string) =>
    setErrors((e) => (e.lines?.[key] ? { ...e, lines: { ...e.lines, [key]: '' } } : e));

  const resetDraft = () => {
    setQty({});
    setRemoved([]);
    setAdded([]);
  };

  const edit = {
    setQty: (id: string, n: number) => {
      setQty((m) => ({ ...m, [id]: n }));
      clearError(id);
    },
    remove: (id: string) => setRemoved((r) => [...r, id]),
    restore: (id: string) => setRemoved((r) => r.filter((x) => x !== id)),
    add: (itemId: string) => setAdded((a) => [...a, { key: `new-${++addedSeq}`, item_id: itemId, qty: 1 }]),
    setAddedQty: (key: string, n: number) => {
      setAdded((a) => a.map((x) => (x.key === key ? { ...x, qty: n } : x)));
      clearError(key);
    },
    dropAdded: (key: string) => setAdded((a) => a.filter((x) => x.key !== key)),
  };

  // Review đổi updated_at của phiếu: vá bản đang xem để lần Lưu sau không bị STALE oan
  const reviewed = (r: ReviewResult) =>
    qc.setQueryData<AdminRequestView>(adminRequestKey(requestId), (v) =>
      v && {
        ...v,
        updated_at: r.request_updated_at,
        lines: v.lines.map((l) => (l.id === r.line.id ? r.line : l)),
      },
    );

  // Review thua đua: nếu nhân viên đã đổi dòng khác thì nháp không còn đúng chỗ → xử như STALE
  const reviewStale = async (lineId: string) => {
    const before = view?.lines ?? [];
    const { data } = await query.refetch();
    if (!data || !othersChanged(before, data.lines, lineId)) return;
    resetDraft();
    setNotice(t('summary.adjust.stale'));
  };

  const save = async () => {
    if (!view || !changed || !reasonOk || saving) return;
    const kept = view.lines.filter((l) => !removed.includes(l.id));
    const keys = [...kept.map((l) => l.id), ...added.map((a) => a.key)];
    const body: AdjustBody = {
      lines: [
        ...kept.map((l) => ({ id: l.id, qty: qtyOf(l) })),
        ...added.map((a) => ({ item_id: a.item_id, qty: a.qty })),
      ],
      expected_updated_at: view.updated_at,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
    setSaving(true);
    setErrors({});
    setNotice(null);
    try {
      await saveAdjust(requestId, body, csrfToken);
      void qc.invalidateQueries({ queryKey: SUMMARY_KEY });
      onSaved();
    } catch (e) {
      if (apiErrorCode(e) === 'STALE_UPDATE') {
        // Bản mới thay bản cũ nên số đã sửa không còn đúng chỗ; lý do vẫn dùng lại được
        resetDraft();
        setNotice(t('summary.adjust.stale'));
        await query.refetch();
      } else {
        setErrors(failureOf(e, keys, t));
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    query,
    view,
    qtyOf,
    removed,
    added,
    edit,
    reason,
    setReason: (v: string) => {
      setReason(v);
      setErrors((e) => ({ ...e, reason: undefined }));
    },
    errors,
    notice,
    saving,
    locked,
    changed,
    canSave: changed && reasonOk && !saving,
    dirty: changed || reason.trim() !== '',
    reviewed,
    reload: () => void query.refetch(),
    reviewStale: (lineId: string) => void reviewStale(lineId),
    save,
  };
}

export type Adjust = ReturnType<typeof useAdjust>;
