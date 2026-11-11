import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isSessionExpired } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useToast } from '@/ui/toast-context';
import { useRequestFormat } from '@/features/request/request-format';
import { lineErrorText } from '../delivery-errors';
import { withRejects, type BulkPlan } from './bulk-plan';
import { DeliverPendingConfirm } from './deliver-pending-confirm';
import { NOT_SENT } from './deliver-send';
import { BULK_MAX_REQUESTS, deliverBulk, type BulkDeliverBody, type BulkRequestResult, type DeliveryPerson } from './delivery-people.api';
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
  const [results, setResults] = useState<BulkRequestResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const count = plan.summary.length;
  const sending = flight.pending;
  const fmt = useRequestFormat();
  // Còn món ngoài danh mục chờ duyệt: hỏi lại trước, rồi gửi kèm reject_line_ids như hộp giao từng người
  const [asking, setAsking] = useState(false);
  const body = withRejects(plan.body, plan.pending);

  // Chia lô ≤ BULK_MAX_REQUESTS phiếu, gửi lần lượt. Lỗi giữa chừng: có phiếu đã giao nên luôn tải lại danh sách,
  // gói cũ không dùng lại được (phiếu đã giao sẽ báo "vừa đổi") → chỉ còn nút Đóng, người dùng chọn lại
  const submit = () =>
    flight.run(async () => {
      setError(null);
      const all: BulkRequestResult[] = [];
      const batches: BulkDeliverBody['requests'][] = [];
      for (let i = 0; i < body.requests.length; i += BULK_MAX_REQUESTS) batches.push(body.requests.slice(i, i + BULK_MAX_REQUESTS));
      try {
        for (const requests of batches) all.push(...(await deliverBulk({ requests }, csrfToken)).results);
      } catch (e) {
        if (isSessionExpired(e) && all.length === 0) {
          setError(t('delivery.confirm.sessionExpired'));
          return;
        }
        const sent = new Set(all.map((r) => r.request_id));
        const rest = body.requests.filter((r) => !sent.has(r.request_id));
        await refresh();
        setError(t(isSessionExpired(e) ? 'delivery.confirm.sessionExpired' : 'delivery.bulk.interrupted'));
        setResults([...all, ...rest.map((r) => ({ request_id: r.request_id, ok: false as const, code: NOT_SENT }))]);
        return;
      }
      await refresh();
      if (all.every((r) => r.ok)) {
        toast.show({ text: t('delivery.bulk.done', { count }) });
        onDone();
      } else setResults(all);
    });

  const reason = (r: Extract<BulkRequestResult, { ok: false }>) =>
    r.code === 'STALE_UPDATE' ? t('delivery.bulk.stale') : r.code === NOT_SENT ? t('delivery.confirm.notSent') : lineErrorText(r, '', t);

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
                <li key={r.request_id} className={r.ok ? 'is-ok' : 'is-err'}>
                  <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                  <b>{nameOf(people, plan.owners[r.request_id])}</b>
                  <span>{r.ok ? t('delivery.confirm.done', { n: r.delivered_units }) : reason(r)}</span>
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
            <button type="button" className="btn btn--primary" disabled={sending} aria-busy={sending} onClick={() => (plan.pending.length > 0 ? setAsking(true) : void submit())}>
              {sending ? t('delivery.confirm.sending') : t('delivery.confirm.ok')}
            </button>
          </>
        )}
      </div>
      {asking && (
        <DeliverPendingConfirm
          title={t('delivery.bulk.title', { count })}
          names={plan.pending.map((l) => fmt.name(l))}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void submit();
          }}
        />
      )}
    </Dialog>
  );
}
