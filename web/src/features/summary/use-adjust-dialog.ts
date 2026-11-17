import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { cutNote } from '@/lib/note-text';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { useRefreshAfterLineChange } from '@/features/delivery/people/use-refresh-after-flow';
import { REVIEW_KEY } from '@/features/review/review.api';
import { useSendState } from '@/features/send-adm/use-send-state';
import { adjustBody, otherNoteMissing, reduceError, type Pick } from './adjust-plan';
import { adjustFailure, isStaleUpdate, type AdjustErrors } from './summary-errors';
import { saveAdjust, useAdminRequest, type AdjustReason } from './summary.api';

export const NOTE_MAX = 200;

// Giảm/từ chối đổi phần đang giữ ở Tủ, Báo cáo, Nhận hàng, Còn nợ
export function useRefreshAfterAdjust() {
  return useRefreshAfterLineChange([REVIEW_KEY]);
}

export function useAdjustDialog(requestId: string, onDone: () => void, preset?: AdjustReason) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterAdjust();
  const flight = useSingleFlight();
  // Lưu xong hộp đóng; bấm đúp sau lượt đầu không gửi lần hai
  const done = useRef(false);
  const query = useAdminRequest(requestId);
  const view = query.data;
  const ownerLeft = !!view && view.user_status !== 'active';
  // Bản có hàng đã gửi NCC của kỳ: giảm sau mốc này thì hàng về dư vào kho (W11)
  const send = useSendState(view?.period_ym ?? '', !!view && !view.is_open);
  const sentAt = send.state === 'sent' ? (send.sent?.created_at ?? null) : null;
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [chosen, setReason] = useState<AdjustReason | undefined>(undefined);
  const [note, setNoteRaw] = useState('');
  const [errors, setErrors] = useState<AdjustErrors>({});
  const [stale, setStale] = useState(false);
  // Lý do chọn sẵn (mở từ ?left=1) chỉ áp cho phiếu của người đã nghỉ thật
  const reason = chosen ?? (ownerLeft ? preset : undefined);
  const lines = view?.lines ?? [];
  const picked = lines.filter((l) => picks[l.id]);
  const badQty = picked.some((l) => {
    const p = picks[l.id];
    return p.mode === 'reduce' && reduceError(l, p.qty) !== null;
  });
  const missingNote = otherNoteMissing(reason, note);
  const blocked = picked.length === 0 ? t('summary.adjust.needLine') : !reason ? t('summary.adjust.needReason') : badQty || missingNote ? t('common.disabledReason.fixErrors') : null;
  const save = () =>
    flight.run(async () => {
      if (!view || !reason || blocked || done.current) return;
      setErrors({});
      try {
        await saveAdjust(requestId, adjustBody(view, picks, reason, note), csrfToken);
        done.current = true;
        void refresh();
        toast.show({ text: t('summary.adjust.saved', { name: view.full_name ?? view.user_sub }), tone: 'ok' });
        onDone();
      } catch (e) {
        if (isStaleUpdate(e)) setStale(true);
        else setErrors(adjustFailure(e, view.lines.map((l) => l.id), t));
      }
    });
  const reloadLatest = async () => {
    await query.refetch();
    setPicks({});
    setStale(false);
  };
  return {
    query,
    view,
    ownerLeft,
    sentAt,
    picks,
    toggle: (id: string, initial: Pick | null) =>
      setPicks((p) => {
        const next = { ...p };
        if (next[id] || !initial) delete next[id];
        else next[id] = initial;
        return next;
      }),
    setPick: (id: string, p: Pick) => setPicks((x) => ({ ...x, [id]: p })),
    reason,
    setReason,
    note,
    setNote: (v: string) => setNoteRaw(cutNote(v, NOTE_MAX)),
    missingNote,
    count: picked.length,
    blocked,
    errors,
    stale,
    reloadLatest,
    save,
    saving: flight.pending,
    dirty: picked.length > 0 || !!chosen || note !== '',
  };
}

export type AdjustDialogState = ReturnType<typeof useAdjustDialog>;
