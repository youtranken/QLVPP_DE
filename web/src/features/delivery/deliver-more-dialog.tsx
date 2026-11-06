import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorNumber, apiErrorString } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { Stepper } from '@/ui/stepper';
import { useToast } from '@/ui/toast-context';
import type { BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';
import { deliverLine, deliverMax } from './delivery.api';
import { langOf } from '@/lib/period-text';
import { blockText, isBlockCode, lineErrorText, makesViewStale } from './delivery-errors';

interface Props {
  line: BacklogLine;
  onDone: () => Promise<unknown>;
  onStale: () => void;
  onClose: () => void;
}

// Dòng ngoài danh mục không có tồn (stock_qty null) nên chỉ giới hạn bởi phần còn lại
export function DeliverMoreDialog({ line, onDone, onStale, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const f = useBacklogFormat();
  const errorId = useId();
  const [cap, setCap] = useState<number | undefined>();
  const [asked, setAsked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flight = useSingleFlight();
  const unit = f.unit(line.unit);
  const max = deliverMax(line.remaining_qty, line.stock_qty, cap);
  const qty = Math.min(asked ?? max, Math.max(max, 1));
  const stock = line.stock_qty === null ? null : Math.min(line.stock_qty, cap ?? line.stock_qty);
  const metaVars = { month: f.monthShort(line.period_ym), r: line.remaining_qty, s: line.stock_qty, unit };

  const fail = (err: unknown) => {
    const code = apiErrorCode(err) ?? '';
    const available = apiErrorNumber(err, 'available');
    const remaining = apiErrorNumber(err, 'remaining');
    if (code === 'STOCK_INSUFFICIENT') setCap(available ?? 0);
    if (code === 'DELIVER_EXCEEDS_QTY') setCap(remaining ?? 0);
    setError(isBlockCode(code) ? blockText(code, t, langOf(i18n.language), apiErrorString(err, 'deadline')) : lineErrorText({ code, available, remaining }, unit, t));
    if (makesViewStale(code)) onStale();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (max < 1) return;
    void flight.run(async () => {
      setError(null);
      try {
        await deliverLine(line.line_id, { qty, expected_delivered_qty: line.delivered_qty }, csrfToken);
        toast.show({ text: t('delivery.backlog.deliver.done', { qty, unit, name: f.name(line), person: f.person(line) }), tone: 'ok' });
        await onDone();
      } catch (err) {
        fail(err);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dismissible={!flight.pending} className="sheet a-form" maxWidth={440}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('delivery.backlog.deliver.title', { name: f.name(line), person: f.person(line) })}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={flight.pending}>
              <Icon name="x" />
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <DialogDescription className="bl-meta">{t(line.stock_qty === null ? 'delivery.backlog.deliver.meta' : 'delivery.backlog.deliver.metaStock', metaVars)}</DialogDescription>
          <div className="bl-field">
            <span className="ff-label">{t('delivery.backlog.deliver.qty')}</span>
            <Stepper
              value={qty}
              min={1}
              max={Math.max(max, 1)}
              label={f.name(line)}
              inputLabel={t('delivery.backlog.deliver.qty')}
              describedBy={error ? errorId : undefined}
              invalid={!!error}
              disabled={max < 1 || flight.pending}
              onChange={setAsked}
            />
            {stock !== null && <small className="bl-after num">{t('delivery.backlog.deliver.after', { n: stock - qty })}</small>}
            <p className="ff-hint">{t('delivery.backlog.deliver.hint', { max, unit })}</p>
            {error && (
              <p id={errorId} role="alert" className="ff-error">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={flight.pending}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={max < 1 || flight.pending} aria-busy={flight.pending}>
            {t('delivery.backlog.deliver.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
