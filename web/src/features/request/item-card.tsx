import { useTranslation } from 'react-i18next';
import type { Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { Stepper } from '@/ui/stepper';
import type { MemberItem } from './request.api';
import { useRequestFormat } from './request-format';
import type { CartLine } from './use-cart';
import './item-card.m1.css';

export function ItemCard({
  item,
  line,
  tone,
  groupLabel,
  onQty,
}: {
  item: MemberItem;
  line: CartLine | undefined;
  tone: Tone;
  groupLabel: string | null;
  onQty: (n: number) => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = fmt.name(item);
  const qty = line?.qty ?? 0;
  const max = line?.max ?? item.max_qty;
  return (
    <article className={`rq-card${qty > 0 ? ' is-picked' : ''}`}>
      <div className="rq-card-tile">
        <ItemThumb fileId={item.image_file_id} alt="" tone={tone} size="tile" />
        {groupLabel && <span className="rq-card-group">{groupLabel}</span>}
        {qty > 0 && (
          <span className="rq-card-badge" data-testid="pick-badge">
            {qty}
          </span>
        )}
      </div>
      <div className="rq-card-body">
        <div className="rq-card-name">
          {name}
          {item.pack_note && <span className="rq-card-pack"> · {item.pack_note}</span>}
        </div>
        <div className="rq-card-unit">{t('request.grid.unitMax', { unit: fmt.unit(item.unit), max: item.max_qty })}</div>
      </div>
      {line?.readonly ? (
        <div className="rq-card-locked">
          {t(line.added_by_admin ? 'request.grid.adminAdded' : 'request.grid.locked', { qty })}
        </div>
      ) : qty === 0 ? (
        <button
          type="button"
          className="rq-card-add"
          aria-label={t('common.stepper.increase', { label: name })}
          disabled={max < 1}
          onClick={() => onQty(1)}
        >
          {t('request.grid.addToCart')}
        </button>
      ) : (
        <Stepper className="rq-card-stepper" value={qty} max={max} label={name} onChange={onQty} />
      )}
    </article>
  );
}
