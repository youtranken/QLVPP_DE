import type { TFunction } from 'i18next';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import type { LineView } from '@/features/request/request.api';
import { useRequestFormat } from '@/features/request/request-format';
import { QtyInput } from '@/ui/qty-input';
import { adjustable, canReduce, floorOf, initialPick, reduceError, reduceRange, targetOf, type Pick, type ReduceError } from './adjust-plan';
import { lineNameOf, lineUnitOf } from './adjust-preview';

interface Props {
  line: LineView;
  pick: Pick | undefined;
  error?: string;
  sentAt: string | null;
  onToggle: (initial: Pick | null) => void;
  onPick: (p: Pick) => void;
}

const parseQty = (raw: string) => (raw.trim() === '' ? null : Number(raw));

const qtyMessage = (t: TFunction, e: ReduceError) =>
  e.kind === 'over' ? t('summary.adjust.reduceOver', { ordered: e.ordered }) : t('summary.adjust.reduceUnder', { min: e.min });

// Một dòng phiếu: tick để chọn, rồi "Giảm còn n" hoặc "Từ chối" (về số đã giao)
export function AdjustPickRow({ line, pick, error, sentAt, onToggle, onPick }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const id = useId();
  const name = lineNameOf(line);
  const unit = fmt.unit(lineUnitOf(line));
  const floor = floorOf(line);
  const status = line.review_status === 'pending' ? t('summary.adjust.pendingHere') : !adjustable(line) ? t('summary.adjust.doneLine') : null;
  const range = reduceRange(line);
  const qtyError = pick?.mode === 'reduce' ? reduceError(line, pick.qty) : null;
  const message = qtyError ? qtyMessage(t, qtyError) : error;
  const initial = initialPick(line);
  return (
    <li className={pick ? 'ajd-row is-picked' : 'ajd-row'}>
      <div className="ajd-row__head">
        {status ? (
          <span className="ajd-row__name is-muted">{name}</span>
        ) : (
          <label className="ajd-row__pick">
            <input type="checkbox" checked={!!pick} aria-label={t('summary.adjust.pick', { name })} onChange={() => onToggle(pick ? null : initial)} />
            <span className="ajd-row__name">{name}</span>
          </label>
        )}
        <span className="ajd-row__qty num">
          {line.qty} {unit}
        </span>
        {floor > 0 && <span className="tag tag--ok tag--sm">{t('summary.adjust.delivered', { n: line.delivered_qty })}</span>}
        {status && <span className="ajd-row__status">{status}</span>}
      </div>
      {pick && (
        <div className="ajd-row__how">
          <div role="radiogroup" aria-label={t('summary.adjust.modeLabel', { name })} className="ajd-row__modes">
            {canReduce(line) && (
              <label className="aj-chip">
                <input type="radio" name={`${id}-mode`} checked={pick.mode === 'reduce'} onChange={() => onPick({ mode: 'reduce', qty: line.qty - 1 })} />
                <span>{t('summary.adjust.reduce')}</span>
              </label>
            )}
            <label className="aj-chip aj-chip--danger">
              <input type="radio" name={`${id}-mode`} checked={pick.mode === 'reject'} onChange={() => onPick({ mode: 'reject' })} />
              <span>{t('summary.adjust.reject')}</span>
            </label>
          </div>
          {pick.mode === 'reject' && floor > 0 && <small className="ajd-row__hint">{t('summary.adjust.rejectKeep', { n: floor })}</small>}
          {pick.mode === 'reduce' && (
            <QtyInput
              steppers
              wrapClassName="ajd-row__stepper"
              min={range.min}
              max={range.max}
              value={pick.qty === null ? '' : String(pick.qty)}
              label={t('summary.adjust.reduceLabel', { name })}
              name={name}
              invalid={!!message}
              aria-describedby={message ? `${id}-err` : undefined}
              onChange={(v) => onPick({ mode: 'reduce', qty: parseQty(v) })}
            />
          )}
          {message && (
            <p id={`${id}-err`} className="ff-error">
              {message}
            </p>
          )}
          {sentAt && !qtyError && targetOf(line, pick) < line.qty && (
            <p className="alert alert--warn ajd-row__warn">{t('warn.W11', { time: formatVnStamp(sentAt), n: line.qty - targetOf(line, pick), unit })}</p>
          )}
        </div>
      )}
    </li>
  );
}
