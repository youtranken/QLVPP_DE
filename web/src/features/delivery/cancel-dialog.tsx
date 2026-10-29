import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorFields } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { REASON_MAX, REASON_MIN, cancelRemaining, type BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';
import { lineFailure } from './delivery-errors';

interface Props {
  line: BacklogLine;
  onDone: () => Promise<unknown>;
  onNotice: (code: string) => void;
  onClose: () => void;
}

type Failure = { field: 'reason' | 'form'; key: string };

function failureOf(err: unknown): Failure | 'notice' {
  const code = apiErrorCode(err);
  if (code === 'REASON_REQUIRED') return { field: 'reason', key: 'delivery.backlog.cancelDialog.required' };
  if (code === 'VALIDATION' && apiErrorFields(err).includes('reason')) return { field: 'reason', key: 'delivery.backlog.cancelDialog.tooLong' };
  return 'notice';
}

export function CancelDialog({ line, onDone, onNotice, onClose }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const f = useBacklogFormat();
  const [reason, setReason] = useState('');
  const [failed, setFailed] = useState<Failure | null>(null);
  const flight = useSingleFlight();
  const note = reason.trim();
  const tooLong = note.length > REASON_MAX;
  const canSubmit = note.length >= REASON_MIN && !tooLong && !flight.pending;
  const fieldError = tooLong ? 'delivery.backlog.cancelDialog.tooLong' : failed?.field === 'reason' ? failed.key : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void flight.run(async () => {
      setFailed(null);
      try {
        await cancelRemaining(line.line_id, { reason: note, expected_delivered_qty: line.delivered_qty }, csrfToken);
        await onDone();
      } catch (err) {
        const failure = failureOf(err);
        if (failure !== 'notice') setFailed(failure);
        else if (lineFailure(err, t).kind === 'request') onNotice(apiErrorCode(err)!);
        else setFailed({ field: 'form', key: 'delivery.backlog.cancelDialog.failed' });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={reason !== ''} dismissible={!flight.pending} className="sheet a-form" maxWidth={480}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">
            {t('delivery.backlog.cancelDialog.title', { n: line.remaining_qty, unit: f.unit(line.unit), person: f.person(line) })}
          </DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={flight.pending}>
              ✕
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <DialogDescription className="bl-meta">{t('delivery.backlog.cancelDialog.meta', { name: f.name(line), month: f.month(line.period_ym) })}</DialogDescription>
          {failed?.field === 'form' && (
            <p role="alert" className="alert alert--danger">
              {t(failed.key)}
            </p>
          )}
          <FormField
            label={t('delivery.backlog.cancelDialog.reason')}
            hint={t('delivery.backlog.cancelDialog.hint')}
            error={fieldError ? t(fieldError, { max: REASON_MAX }) : undefined}
          >
            {(p) => (
              <textarea
                {...p}
                rows={3}
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
            <button type="button" className="btn" disabled={flight.pending}>
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
