import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { Stepper } from '@/ui/stepper';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { DeliveryPersonLine } from './delivery-people.api';
import type { Shortage } from './deliver-plan';

export interface LineWaiting {
  people: number;
  qty: number;
}

interface Props {
  line: DeliveryPersonLine;
  value: number;
  max: number;
  taken: boolean;
  waiting: LineWaiting;
  shortage?: Shortage;
  disabled: boolean;
  onChange: (n: number) => void;
}

function Control({ line, value, max, taken, disabled, onChange }: Pick<Props, 'line' | 'value' | 'max' | 'taken' | 'disabled' | 'onChange'>) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = fmt.name(line);
  if (line.review_status === 'pending') {
    return (
      <span className="pp-row__review">
        <span className="tag tag--warn">{t('delivery.people.panel.pendingReview')}</span>
        <Link to={`/admin/review?status=pending&ym=${line.period_ym}`}>{t('delivery.people.panel.reviewLink')}</Link>
      </span>
    );
  }
  // Món ngoài DM không có tủ: trần 0 nghĩa là hàng chưa về
  if (max <= 0) return <span className="pp-row__oos">{t(line.item_id === null ? 'delivery.people.panel.notReceived' : taken ? 'delivery.people.panel.allocatedAbove' : 'delivery.people.panel.outOfStock')}</span>;
  return <Stepper className="pp-row__step" value={value} min={0} max={max} disabled={disabled} label={t('delivery.people.panel.qty', { name })} onChange={onChange} />;
}

export function PersonLineRow({ line, value, max, taken, waiting, shortage, disabled, onChange }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const reviewing = line.review_status === 'pending';
  const owe = line.remaining_qty - value;
  const meta =
    line.stock_qty === null
      ? t('delivery.people.panel.needNoStock', { n: line.remaining_qty })
      : waiting.people > 0
        ? t('delivery.people.panel.lineInfo', { need: line.remaining_qty, stock: line.stock_qty, k: waiting.people, q: waiting.qty })
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
          {shortage && <small className="pp-row__short">{t('warn.W19row', { ...shortage })}</small>}
        </div>
        <Control line={line} value={value} max={max} taken={taken} disabled={disabled} onChange={onChange} />
      </div>
      {!reviewing && max > 0 && owe > 0 && (
        <div className="pp-row__warn">
          <strong>{t(line.is_debt ? 'delivery.people.panel.shortDebt' : 'delivery.people.panel.short', { give: value, owe })}</strong>
        </div>
      )}
    </li>
  );
}
