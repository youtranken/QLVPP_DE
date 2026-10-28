import { useTranslation } from 'react-i18next';
import { fileUrl } from '@/features/catalog/catalog.api';
import { Stepper } from '@/ui/stepper';
import type { MemberItem } from './request.api';
import { useRequestFormat } from './request-format';
import type { CartLine } from './use-cart';

export function ItemThumb({
  name,
  imageId,
  tint,
  className,
}: {
  name: string;
  imageId: string | null;
  tint: string;
  className: string;
}) {
  return (
    <span className={`${className} ${tint}`} aria-hidden="true">
      {imageId ? <img src={fileUrl(imageId)} alt="" loading="lazy" /> : <b>{name.trim().charAt(0).toUpperCase()}</b>}
    </span>
  );
}

export function ItemCard({
  item,
  line,
  tint,
  onQty,
}: {
  item: MemberItem;
  line: CartLine | undefined;
  tint: string;
  onQty: (n: number) => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = fmt.name(item);
  const qty = line?.qty ?? 0;
  return (
    <article className={`rq-card${qty > 0 ? ' is-picked' : ''}`}>
      <ItemThumb name={name} imageId={item.image_file_id} tint={tint} className="rq-card-img" />
      <div className="rq-card-name">
        {name}
        {item.pack_note && <span className="rq-card-pack"> · {item.pack_note}</span>}
      </div>
      <div className="rq-card-unit">{t('request.grid.unitMax', { unit: fmt.unit(item.unit), max: item.max_qty })}</div>
      {line?.readonly ? (
        <div className="rq-card-locked">
          {t(line.added_by_admin ? 'request.grid.adminAdded' : 'request.grid.locked', { qty })}
        </div>
      ) : (
        <Stepper value={qty} max={item.max_qty} label={name} onChange={onQty} />
      )}
    </article>
  );
}
