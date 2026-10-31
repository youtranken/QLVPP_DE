import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorFields, apiErrorNumber } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { Icon } from '@/ui/icon';
import { useToast } from '@/ui/toast-context';
import { REASON_MAX, REASON_MIN, cancelRemaining, type BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';

interface Props {
  line: BacklogLine;
  onDone: () => Promise<unknown>;
  onStale: () => void;
  onClose: () => void;
}

type Failure = { reason: string } | { block: string; vars?: Record<string, number> };

const BLOCKS = new Set(['PERIOD_NOT_LOCKED', 'LINE_NOT_REVIEWED', 'LINE_REJECTED', 'LINE_NOT_FOUND']);

export function CancelDialog({ line, onDone, onStale, onClose }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const f = useBacklogFormat();
  const [reason, setReason] = useState('');
  const [failed, setFailed] = useState<Failure | null>(null);
  const [seen, setSeen] = useState<{ qty: number; delivered: number } | null>(null);
  const flight = useSingleFlight();
  const note = reason.trim();
  const qty = seen?.qty ?? line.qty;
  const delivered = seen?.delivered ?? line.delivered_qty;
  const owed = qty - delivered - line.cancelled_qty;
  const unit = f.unit(line.unit);
  const canSubmit = note.length >= REASON_MIN && !flight.pending;
  const fieldError = failed && 'reason' in failed ? t(failed.reason, { max: REASON_MAX }) : undefined;

  const fail = (err: unknown) => {
    const code = apiErrorCode(err) ?? '';
    if (code === 'REASON_REQUIRED') return setFailed({ reason: 'delivery.backlog.cancelDialog.required' });
    if (code === 'VALIDATION' && apiErrorFields(err).includes('reason')) return setFailed({ reason: 'delivery.backlog.cancelDialog.tooLong' });
    if (code === 'STALE_UPDATE') {
      const next = { qty: apiErrorNumber(err, 'qty') ?? qty, delivered: apiErrorNumber(err, 'delivered_qty') ?? delivered };
      setSeen(next);
      setFailed({ block: 'delivery.backlog.cancelDialog.stale', vars: { qty: next.qty, delivered: next.delivered } });
    } else {
      setFailed({ block: `delivery.backlog.cancelDialog.block.${BLOCKS.has(code) ? code : 'UNKNOWN'}` });
    }
    onStale();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void flight.run(async () => {
      setFailed(null);
      try {
        const res = await cancelRemaining(line.line_id, { reason: note, expected_delivered_qty: delivered, expected_qty: qty }, csrfToken);
        const n = res.cancelled_now;
        toast.show(
          n > 0
            ? { text: t('delivery.backlog.cancelDialog.done', { n, unit, name: f.name(line), person: f.person(line) }), tone: 'ok' }
            : { text: t('delivery.backlog.cancelDialog.none'), tone: 'info' },
        );
        await onDone();
      } catch (err) {
        fail(err);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={reason !== ''} dismissible={!flight.pending} className="sheet a-form" maxWidth={480}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('delivery.backlog.cancelDialog.title', { n: owed, unit, person: f.person(line) })}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={flight.pending}>
              <Icon name="x" />
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <DialogDescription className="bl-meta">
            {t('delivery.backlog.cancelDialog.meta', { name: f.name(line), month: f.monthShort(line.period_ym), short: f.short(line) })}
          </DialogDescription>
          {failed && 'block' in failed && (
            <p role="alert" className="alert alert--warn">
              {t(failed.block, failed.vars)}
            </p>
          )}
          <FormField
            label={t('delivery.backlog.cancelDialog.reason')}
            hint={t('delivery.backlog.cancelDialog.hint')}
            error={fieldError}
            counter={{ value: reason.length, max: REASON_MAX }}
            required
          >
            {(p) => (
              <textarea
                {...p}
                rows={3}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setFailed(null);
                }}
              />
            )}
          </FormField>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={flight.pending}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--danger" disabled={!canSubmit} aria-busy={flight.pending}>
            {t('delivery.backlog.cancelDialog.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
