import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitNames } from '@/features/units/units.api';
import { ItemThumb } from '@/ui/item-thumb';
import type { CatalogRow } from './catalog-rows';
import { useCardUpload } from './use-card-upload';
import { useItemName } from './use-item-name';

function StockBadge({ row }: { row: CatalogRow }) {
  const { t } = useTranslation();
  if (row.stock_state === 'untracked') return null;
  const out = row.stock_state === 'out';
  return <span className={`ct-card__stock ct-card__stock--${out ? 'out' : row.stock_state === 'low' ? 'low' : 'ok'}`}>{out ? t('catalog.grid.stockOut') : t('catalog.grid.stockLeft', { n: row.stock_qty })}</span>;
}

function UploadButton({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const { busy, error, upload } = useCardUpload(id, name);
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
        <span role="alert" className="ct-card__error">
          {error}
        </span>
      )}
    </>
  );
}

export function CatalogCard({ row, groupName, onEdit }: { row: CatalogRow; groupName: string; onEdit: (id: string) => void }) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  const name = useItemName()(row);
  const meta = [row.code, t('request.grid.unitMax', { unit: unitName(row.unit), max: row.max_qty })].filter(Boolean).join(' · ');
  return (
    <article className={`ct-card${row.active ? '' : ' is-inactive'}`}>
      <div className="ct-card__tile">
        <ItemThumb fileId={row.image_file_id} alt={name} tone={row.tone} size="card" />
        <span className="ct-card__group">{groupName}</span>
        <StockBadge row={row} />
        {row.image_file_id === null && (
          <div className="ct-card__noimg">
            <span>{t('catalog.grid.noImage')}</span>
            <UploadButton id={row.id} name={name} />
          </div>
        )}
      </div>
      <div className="ct-card__body">
        <h3 className="ct-card__name">{name}</h3>
        <p className="ct-card__meta">{meta}</p>
      </div>
      <button type="button" className="btn btn--sm ct-card__edit" aria-label={t('catalog.page.editLabel', { name })} onClick={() => onEdit(row.id)}>
        {t('catalog.page.edit')}
      </button>
    </article>
  );
}
