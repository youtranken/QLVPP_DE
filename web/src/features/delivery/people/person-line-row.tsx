import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { Stepper } from '@/ui/stepper';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { DeliveryPersonLine } from './delivery-people.api';

export interface LineWaiting {
  people: number;
  qty: number;
}

interface Props {
  line: DeliveryPersonLine;
  value: number;
  max: number;
  error?: string;
  waiting: LineWaiting;
  disabled: boolean;
  onChange: (n: number) => void;
}

function Control({ line, value, max, disabled, onChange }: Pick<Props, 'line' | 'value' | 'max' | 'disabled' | 'onChange'>) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = fmt.name(line);
  if (line.review_status === 'pending') {
    return (
      <span className="pp-row__review">
        <span className="tag tag--warn">{t('delivery.people.panel.pendingReview')}</span>
        <Link to="/admin/review">{t('delivery.people.panel.reviewLink')}</Link>
      </span>
    );
  }
  if (max <= 0) return <span className="pp-row__oos">{t('delivery.people.panel.outOfStock')}</span>;
  return <Stepper className="pp-row__step" value={value} min={1} max={max} disabled={disabled} label={t('delivery.people.panel.qty', { name })} onChange={onChange} />;
}

export function PersonLineRow({ line, value, max, error, waiting, disabled, onChange }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const reviewing = line.review_status === 'pending';
  const owe = line.remaining_qty - value;
  const meta =
    line.stock_qty === null
      ? t('delivery.people.panel.needNoStock', { n: line.remaining_qty })
      : t('delivery.people.panel.need', { n: line.remaining_qty, stock: line.stock_qty });
  return (
    <li className="pp-row">
      <div className="pp-row__main">
        <ItemThumb fileId={line.image_file_id} alt="" tone="g0" size={48} />
        <div className="pp-row__text">
          <b className="pp-row__name">{fmt.name(line)}</b>
          <small>
            {line.is_debt && <span className="pp-row__from">{t('delivery.people.panel.fromMonth', { month: monthOf(line.period_ym) })}</span>}
            {meta}
          </small>
        </div>
        <Control line={line} value={value} max={max} disabled={disabled} onChange={onChange} />
      </div>
      {!reviewing && max > 0 && owe > 0 && (
        <div className="pp-row__warn">
          <strong>{t('delivery.people.panel.short', { give: value, owe })}</strong>
          {waiting.people > 0 && <span> {t('delivery.people.panel.waiting', { n: waiting.people, qty: waiting.qty })}</span>}
        </div>
      )}
      {error && (
        <p role="alert" className="pp-row__err">
          {error}
        </p>
      )}
    </li>
  );
}
