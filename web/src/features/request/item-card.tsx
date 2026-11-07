import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { PausedStamp } from '@/ui/paused-stamp';
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
  paused = false,
  onQty,
}: {
  item: MemberItem;
  line: CartLine | undefined;
  tone: Tone;
  groupLabel: string | null;
  paused?: boolean;
  onQty: (n: number) => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = fmt.name(item);
  const qty = line?.qty ?? 0;
  const max = line?.max ?? item.max_qty;
  const addRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  // Bấm − về 0 thì stepper biến mất: đưa focus sang nút "Thêm vào phiếu" mới
  useEffect(() => {
    if (qty === 0 && refocus.current) addRef.current?.focus();
    refocus.current = false;
  }, [qty]);
  const change = (n: number) => {
    if (n === 0) refocus.current = true;
    onQty(n);
  };
  return (
    <article className={`rq-card${qty > 0 ? ' is-picked' : ''}${paused ? ' is-paused' : ''}`}>
      <div className="rq-card-tile">
        <ItemThumb fileId={item.image_file_id} alt="" tone={tone} size="tile" />
        {paused && <PausedStamp />}
        {groupLabel && <span className="rq-card-group">{groupLabel}</span>}
        {qty > 0 && (
          <span className="rq-card-badge" data-testid="pick-badge">
            {qty}
          </span>
        )}
      </div>
      <div className="rq-card-body">
        <div className="rq-card-name" title={name}>
          {name}
          {item.pack_note && <span className="rq-card-pack"> · {item.pack_note}</span>}
        </div>
        <div className="rq-card-unit">{t('request.grid.unitMax', { unit: fmt.unit(item.unit), max: item.max_qty })}</div>
      </div>
      {line?.readonly || (paused && qty > 0) ? (
        <div className="rq-card-locked">
          {t(line?.added_by_admin ? 'request.grid.adminAdded' : 'request.grid.locked', { qty })}
        </div>
      ) : paused ? (
        <button type="button" className="rq-card-add" aria-label={`${t('request.grid.paused')}: ${name}`} disabled>
          {t('request.grid.paused')}
        </button>
      ) : qty === 0 ? (
        <button
          type="button"
          className="rq-card-add"
          ref={addRef}
          aria-label={t('request.grid.addAria', { name })}
          disabled={max < 1}
          onClick={() => onQty(1)}
        >
          {t('request.grid.addToCart')}
        </button>
      ) : (
        <Stepper className="rq-card-stepper" value={qty} max={max} label={name} onChange={change} />
      )}
    </article>
  );
}
