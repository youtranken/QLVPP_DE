import { useId } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Stepper } from '@/ui/stepper';
import type { LineModel } from './delivery-lines';

function GiveCell({ m, errorId, disabled, reviewHref, onQty }: { m: LineModel; errorId: string; disabled: boolean; reviewHref: string; onQty: (n: number) => void }) {
  const { t } = useTranslation();
  if (m.line.review_status === 'pending') {
    return (
      <span className="dv-give__note">
        <span className="tag tag--warn">{t('delivery.detail.pending')}</span>
        <Link to={reviewHref}>{t('delivery.detail.review')}</Link>
      </span>
    );
  }
  if (m.line.review_status === 'rejected') return <span className="tag">{t('delivery.detail.rejected')}</span>;
  if (!m.deliverable) return <span className="tag tag--ok">{t('delivery.detail.done')}</span>;
  return (
    <span className="dv-give">
      <Stepper
        value={m.qty}
        min={1}
        max={m.max}
        label={m.name}
        inputLabel={t('delivery.detail.qtyLabel', { name: m.name })}
        describedBy={m.error ? errorId : undefined}
        invalid={!!m.error}
        disabled={disabled || m.max < 1}
        onChange={onQty}
      />
      {m.max < 1 && <small className="dv-give__out">{t('delivery.detail.outOfStock', { n: m.remaining })}</small>}
    </span>
  );
}

export function DeliveryLineRow({
  m,
  thumb,
  selected,
  sending,
  disabled,
  reviewHref,
  onQty,
  onToggle,
  onDeliver,
}: {
  m: LineModel;
  thumb: ReactNode;
  selected: boolean;
  sending: boolean;
  disabled: boolean;
  reviewHref: string;
  onQty: (n: number) => void;
  onToggle: () => void;
  onDeliver: () => void;
}) {
  const { t } = useTranslation();
  const errorId = useId();
  const canPick = m.deliverable && m.max >= 1;
  return (
    <tr className={m.error ? 'dv-line has-error' : m.short ? 'dv-line is-short' : 'dv-line'}>
      <td className="sel">
        <input type="checkbox" aria-label={t('delivery.detail.select', { name: m.name })} checked={canPick && selected} disabled={!canPick} onChange={onToggle} />
      </td>
      <td>
        <div className="dv-item">
          {thumb}
          <div className="dv-item__text">
            <b>{m.name}</b>
            {m.unit && <small>{m.unit}</small>}
            {m.error && (
              <p id={errorId} className="dv-line__error">
                {m.error}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="num r">{m.line.qty}</td>
      <td className="num r">
        {m.line.delivered_qty}
        {m.line.cancelled_qty > 0 && <small className="dv-cancelled">{t('delivery.detail.cancelled', { n: m.line.cancelled_qty })}</small>}
      </td>
      <td className="num r">{m.stock ?? '—'}</td>
      <td className="r">
        <GiveCell m={m} errorId={errorId} disabled={disabled} reviewHref={reviewHref} onQty={onQty} />
      </td>
      <td className="r">
        {m.deliverable && (
          <button
            type="button"
            className="btn btn--sm"
            aria-label={t('delivery.detail.deliverLabel', { name: m.name })}
            aria-busy={sending || undefined}
            disabled={disabled || m.max < 1}
            onClick={onDeliver}
          >
            {t('delivery.detail.deliver')}
          </button>
        )}
      </td>
    </tr>
  );
}
