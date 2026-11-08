import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useToast } from '@/ui/toast-context';
import { lineErrorText } from '../delivery-errors';
import type { BulkPlan } from './bulk-plan';
import { deliverBulk, type BulkRequestResult, type DeliveryPerson } from './delivery-people.api';
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

  const submit = () =>
    flight.run(async () => {
      setError(null);
      try {
        const res = await deliverBulk(plan.body, csrfToken);
        await refresh();
        if (res.results.every((r) => r.ok)) {
          toast.show({ text: t('delivery.bulk.done', { n: count }) });
          onDone();
        } else setResults(res.results);
      } catch (e) {
        const expired = e instanceof ApiError && (e.status === 401 || (e.status === 403 && apiErrorCode(e) === 'CSRF_INVALID'));
        setError(t(expired ? 'delivery.confirm.sessionExpired' : 'delivery.confirm.network'));
      }
    });

  const reason = (r: Extract<BulkRequestResult, { ok: false }>) =>
    r.code === 'STALE_UPDATE' ? t('delivery.bulk.stale') : lineErrorText(r, '', t);

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
          {t('delivery.bulk.title', { n: count })}
        </DialogTitle>
        <DialogDescription className="sr-only">{t('delivery.bulk.noUndo')}</DialogDescription>
      </div>
      <div className="sheet-body">
        {results ? (
          <div role="status" aria-live="polite" className="dd-results">
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
            <button type="button" className="btn btn--primary" disabled={sending} aria-busy={sending} onClick={() => void submit()}>
              {sending ? t('delivery.confirm.sending') : t('delivery.confirm.ok')}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
