import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isSessionExpired } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { undoActions } from '@/lib/undo.api';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useToast } from '@/ui/toast-context';
import { lineErrorText } from '../delivery-errors';
import type { BulkPlan } from './bulk-plan';
import { byPerson, sendBulk, type PersonResult } from './bulk-send';
import { NOT_SENT } from './deliver-send';
import type { BulkRequestResult, DeliveryPerson } from './delivery-people.api';
import { useAskThenSubmit } from './use-ask-reject';
import { useRefreshAfterLineChange } from './use-refresh-after-flow';

interface Props {
  plan: BulkPlan;
  people: DeliveryPerson[];
  onClose: () => void;
  onDone: () => void;
}

const nameOf = (people: DeliveryPerson[], sub: string | undefined) => {
  const p = people.find((x) => x.user_sub === sub);
  return p ? (p.full_name ?? p.user_sub) : (sub ?? '');
};

export function BulkDeliverDialog({ plan, people, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterLineChange([['admin-request']]);
  const flight = useSingleFlight();
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Giao xong là xong: cú bấm thứ hai của bấm đúp tới sau khi lượt đầu đã trả về (khóa bay đã mở) không được gửi lại
  const delivered = useRef(false);
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const count = plan.summary.length;
  const sending = flight.pending;

  // Lỗi giữa chừng: có phiếu đã giao nên luôn tải lại danh sách, gói cũ không dùng lại được (phiếu đã giao sẽ báo "vừa đổi")
  // → chỉ còn nút Đóng, người dùng chọn lại
  const submit = () =>
    flight.run(async () => {
      if (delivered.current) return;
      setError(null);
      const { sent, error: e, undoIds } = await sendBulk(plan, csrfToken);
      if (e && isSessionExpired(e) && sent.every((s) => s.result.ok === false && s.result.code === NOT_SENT)) {
        setError(t('delivery.confirm.sessionExpired'));
        return;
      }
      await refresh();
      if (e) setError(t(isSessionExpired(e) ? 'delivery.confirm.sessionExpired' : 'delivery.bulk.interrupted'));
      const rows = byPerson(sent, plan.owners);
      if (!e && rows.every((r) => r.ok)) {
        delivered.current = true;
        const undo = undoIds ? () => undoActions('delivery', undoIds, csrfToken).then(refresh) : undefined;
        toast.show({ text: t('delivery.bulk.done', { count }), undo });
        onDone();
      } else setResults(rows);
    });
  // Còn món ngoài danh mục chờ duyệt: hỏi lại trước, rồi gửi kèm reject_line_ids như hộp giao từng người
  const ask = useAskThenSubmit(plan.pending, t('delivery.bulk.title', { count }), () => void submit());

  const reason = (r: Extract<BulkRequestResult, { ok: false }>) =>
    r.code === 'STALE_UPDATE' ? t('delivery.bulk.stale') : r.code === NOT_SENT ? t('delivery.confirm.notSent') : lineErrorText(r, '', t);
  const text = (r: PersonResult) =>
    [
      r.units > 0 && t('delivery.confirm.done', { n: r.units }),
      r.rejected > 0 && t('delivery.bulk.rejected', { k: r.rejected }),
      ...new Set(r.failures.map(reason)),
      r.skippedRejects > 0 && t('delivery.confirm.rejectSkipped'),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && (results ? onDone() : onClose())}
      dismissible={!sending}
      className="sheet a-form dd-sheet"
      maxWidth={560}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        titleRef.current?.focus();
      }}
    >
      <div className="sheet-header">
        <DialogTitle ref={titleRef} tabIndex={-1} className="sheet-title">
          {t('delivery.bulk.title', { count })}
        </DialogTitle>
        <DialogDescription className="sr-only">{t('delivery.bulk.noUndo')}</DialogDescription>
      </div>
      <div className="sheet-body">
        {results ? (
          <div role="status" aria-live="polite" className="dd-results">
            {error && (
              <p role="alert" className="dd-expired">
                {error}
              </p>
            )}
            <ul>
              {results.map((r) => (
                <li key={r.user_sub} className={r.ok ? 'is-ok' : 'is-err'}>
                  <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                  <b>{nameOf(people, r.user_sub)}</b>
                  <span>{text(r)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <ul className="bd-list">
              {plan.summary.map((s) => (
                <li key={s.user_sub}>
                  <b>{nameOf(people, s.user_sub)}</b>
                  <span className="num">{t('delivery.bulk.line', { n: s.items, u: s.give })}</span>
                  {s.left > 0 && <small className="bd-left">{t('delivery.bulk.left', { n: s.left })}</small>}
                </li>
              ))}
            </ul>
            <p className="dd-note">{t('delivery.bulk.noUndo')}</p>
            {error && (
              <p role="alert" className="dd-expired">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      <div className="sheet-footer">
        {results ? (
          <DialogClose asChild>
            <button type="button" className="btn btn--primary">
              {t('delivery.confirm.close')}
            </button>
          </DialogClose>
        ) : (
          <>
            <DialogClose asChild>
              <button type="button" className="btn btn--ghost" disabled={sending}>
                {t('delivery.confirm.cancel')}
              </button>
            </DialogClose>
            <button type="button" className="btn btn--primary" disabled={sending} aria-busy={sending} onClick={ask}>
              {sending ? t('delivery.confirm.sending') : t('delivery.confirm.ok')}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
