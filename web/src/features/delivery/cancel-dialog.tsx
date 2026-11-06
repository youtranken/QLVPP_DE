import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorFields, apiErrorNumber } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { Icon } from '@/ui/icon';
import { useToast } from '@/ui/toast-context';
import { CANCEL_REASONS, OTHER_NOTE_MIN, REASON_MAX, cancelRemaining, type BacklogLine, type CancelReason } from './backlog.api';
import { useBacklogFormat } from './backlog-format';

interface Props {
  line: BacklogLine;
  // Tháng đang giao: phiếu gửi ADM tháng này có thể đã tính phần nợ của dòng
  sentYm?: string;
  initialReason?: CancelReason;
  onDone: () => Promise<unknown>;
  onStale: () => void;
  onClose: () => void;
}

type Failure = { note: string } | { block: string; vars?: Record<string, number> };

const BLOCKS = new Set(['NOT_DEBT_YET', 'PERIOD_NOT_LOCKED', 'LINE_NOT_REVIEWED', 'LINE_REJECTED', 'LINE_NOT_FOUND']);
const KEY = 'delivery.backlog.cancelDialog';

function ReasonChoice({ value, onChange }: { value: CancelReason | null; onChange: (r: CancelReason) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="ff">
      <span id={`${id}-label`} className="ff-label">
        {t(`${KEY}.reason`)}
        <span className="ff-req" aria-hidden="true"> *</span>
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="bl-reasons">
        {CANCEL_REASONS.map((r) => (
          <label key={r} className="bl-reason">
            <input type="radio" name={`${id}-reason`} checked={value === r} onChange={() => onChange(r)} />
            {t(`${KEY}.reasons.${r}`)}
          </label>
        ))}
      </div>
    </div>
  );
}

function useCancelForm(line: BacklogLine, initialReason: CancelReason | undefined) {
  const [code, setCode] = useState<CancelReason | null>(initialReason ?? null);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState<Failure | null>(null);
  const [seen, setSeen] = useState<{ qty: number; delivered: number } | null>(null);
  const trimmed = note.trim();
  const ready = code !== null && (code !== 'other' || [...trimmed].length >= OTHER_NOTE_MIN);
  return { code, setCode, note, setNote, trimmed, failed, setFailed, setSeen, qty: seen?.qty ?? line.qty, delivered: seen?.delivered ?? line.delivered_qty, ready };
}

export function CancelDialog({ line, sentYm, initialReason, onDone, onStale, onClose }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const f = useBacklogFormat();
  const form = useCancelForm(line, initialReason);
  const flight = useSingleFlight();
  const { qty, delivered, failed } = form;
  const owed = qty - delivered - line.cancelled_qty;
  const unit = f.unit(line.unit);
  const counted = line.counted_in_snapshot_qty ?? 0;
  const canSubmit = form.ready && !flight.pending;
  const noteError = failed && 'note' in failed ? t(failed.note, { max: REASON_MAX }) : undefined;

  const fail = (err: unknown) => {
    const code = apiErrorCode(err) ?? '';
    if (code === 'REASON_REQUIRED') return form.setFailed({ note: `${KEY}.required` });
    if (code === 'VALIDATION' && apiErrorFields(err).includes('reason')) return form.setFailed({ note: `${KEY}.tooLong` });
    if (code === 'STALE_UPDATE') {
      const next = { qty: apiErrorNumber(err, 'qty') ?? qty, delivered: apiErrorNumber(err, 'delivered_qty') ?? delivered };
      form.setSeen(next);
      form.setFailed({ block: `${KEY}.stale`, vars: { qty: next.qty, delivered: next.delivered } });
    } else {
      form.setFailed({ block: `${KEY}.block.${BLOCKS.has(code) ? code : 'UNKNOWN'}` });
    }
    onStale();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !form.code) return;
    const body = { reason_code: form.code, ...(form.trimmed ? { reason: form.trimmed } : {}), expected_delivered_qty: delivered, expected_qty: qty };
    void flight.run(async () => {
      form.setFailed(null);
      try {
        const n = (await cancelRemaining(line.line_id, body, csrfToken)).cancelled_now;
        toast.show(n > 0 ? { text: t(`${KEY}.done`, { n, unit, name: f.name(line), person: f.person(line) }), tone: 'ok' } : { text: t(`${KEY}.none`), tone: 'info' });
        await onDone();
      } catch (err) {
        fail(err);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={form.note !== ''} dismissible={!flight.pending} className="sheet a-form" maxWidth={480}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t(`${KEY}.title`, { n: owed, unit, name: f.name(line), person: f.person(line) })}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={flight.pending}>
              <Icon name="x" />
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body bl-cancel">
          {counted > 0 && sentYm && <p className="alert alert--warn">{t('warn.W23', { m: f.monthShort(sentYm), n: counted, unit })}</p>}
          {failed && 'block' in failed && (
            <p role="alert" className="alert alert--warn">
              {t(failed.block, failed.vars)}
            </p>
          )}
          <ReasonChoice
            value={form.code}
            onChange={(r) => {
              form.setCode(r);
              form.setFailed(null);
            }}
          />
          <FormField label={t(`${KEY}.note`)} hint={t(`${KEY}.noteHint`)} error={noteError} counter={{ value: form.note.length, max: REASON_MAX }} required={form.code === 'other'}>
            {(p) => (
              <textarea
                {...p}
                rows={2}
                maxLength={REASON_MAX}
                value={form.note}
                onChange={(e) => {
                  form.setNote(e.target.value);
                  form.setFailed(null);
                }}
              />
            )}
          </FormField>
          <DialogDescription className="bl-meta">{t(`${KEY}.seen`)}</DialogDescription>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={flight.pending}>
              {t(`${KEY}.back`)}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--danger btn--solid" disabled={!canSubmit} aria-busy={flight.pending}>
            {t(`${KEY}.submit`)}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
