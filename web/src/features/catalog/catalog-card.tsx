import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useRequestFormat } from '@/features/request/request-format';
import { useUnitNames } from '@/features/units/units.api';
import { Icon } from '@/ui/icon';
import { ItemThumb } from '@/ui/item-thumb';
import type { CatalogRow } from './catalog-rows';
import { useCardUpload } from './use-card-upload';

function UploadButton({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const { busy, error, upload, dismiss } = useCardUpload(id, name);
  return (
    <>
      <label className={`btn btn--primary btn--sm ct-card__upload${busy ? ' is-disabled' : ''}`}>
        {busy ? t('catalog.grid.uploading') : t('catalog.grid.upload')}
        <input
          type="file"
          className="sr-only"
          accept="image/*"
          aria-label={t('catalog.grid.uploadFor', { name })}
          disabled={busy}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {error && (
        <span className="ct-card__error">
          <span role="alert" className="ct-card__error-text">
            {error}
          </span>
          <button type="button" className="ct-card__error-x" aria-label={t('catalog.grid.dismissError')} onClick={dismiss}>
            <Icon name="x" size={14} />
          </button>
        </span>
      )}
    </>
  );
}

export function CatalogCard({ row, groupName, open = false, onEdit }: { row: CatalogRow; groupName: string; open?: boolean; onEdit: (id: string) => void }) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  const name = useRequestFormat().name(row);
  const meta = [row.code, t('request.grid.unitMax', { unit: unitName(row.unit), max: row.max_qty })].filter(Boolean).join(' · ');
  return (
    <article className={['ct-card', row.active ? '' : 'is-inactive', open ? 'is-open' : ''].filter(Boolean).join(' ')}>
      <div className="ct-card__tile">
        <ItemThumb fileId={row.image_file_id} alt={name} tone={row.tone} size="card" />
        <span className="ct-card__group">{groupName}</span>
        {row.image_file_id === null && (
          <div className="ct-card__noimg">
            <span>{t('catalog.grid.noImage')}</span>
            {row.active && <UploadButton id={row.id} name={name} />}
          </div>
        )}
      </div>
      <div className="ct-card__body">
        <h3 className="ct-card__name">{name}</h3>
        <p className="ct-card__meta">{meta}</p>
        <p className="ct-card__stock">{t('catalog.card.stock', { n: row.stock_qty })}</p>
      </div>
      <button type="button" className="btn btn--sm ct-card__edit" aria-label={t('catalog.page.editLabel', { name })} onClick={() => onEdit(row.id)}>
        {t('catalog.page.edit')}
      </button>
    </article>
  );
}
