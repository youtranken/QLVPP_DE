import { useId, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useRequestFormat } from '@/features/request/request-format';
import { useUnitNames } from '@/features/units/units.api';
import { Icon } from '@/ui/icon';
import { ItemThumb } from '@/ui/item-thumb';
import { useToast } from '@/ui/toast-context';
import { useRefreshCatalog } from './catalog.api';
import type { CatalogRow } from './catalog-rows';
import { useItemActive } from './use-item-active';
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

// Nút "Tạm ngưng" (đỏ) / "Dùng lại" trên thẻ: cùng hành vi công tắc món trong panel nhóm (W24, khóa khi nhóm ngừng, toast Hoàn tác)
function ActiveButton({ row, name, groupActive }: { row: CatalogRow; name: string; groupActive: boolean }) {
  const { t } = useTranslation();
  const refresh = useRefreshCatalog();
  const toast = useToast();
  const hintId = useId();
  const { checked, locked, error, send } = useItemActive({ item: row, name, groupActive, refresh, notify: toast.show });
  return (
    <>
      <button
        type="button"
        className={checked ? 'btn btn--sm btn--danger' : 'btn btn--sm'}
        aria-label={t(checked ? 'catalog.grid.pauseFor' : 'catalog.grid.reactivateFor', { name })}
        aria-describedby={locked ? hintId : undefined}
        disabled={locked}
        onClick={() => void send(!checked)}
      >
        {t(checked ? 'catalog.grid.pause' : 'catalog.categories.reactivate')}
      </button>
      {locked && (
        <small id={hintId} className="ct-card__hint">
          {t('catalog.categories.enableGroupFirst')}
        </small>
      )}
      {error && (
        <span role="alert" className="ct-card__error-text ct-card__active-error">
          {error}
        </span>
      )}
    </>
  );
}

interface CardProps {
  row: CatalogRow;
  groupName: string;
  groupActive: boolean;
  open?: boolean;
  onEdit: (id: string) => void;
}

export function CatalogCard({ row, groupName, groupActive, open = false, onEdit }: CardProps) {
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
        {row.inactive_reason === 'item' && <span className="tag tag--outline ct-card__tag">{t('catalog.categories.byItem')}</span>}
        {row.inactive_reason === 'group' && <span className="tag tag--warn ct-card__tag">{t('catalog.categories.byGroup')}</span>}
        <p className="ct-card__meta">{meta}</p>
        <p className="ct-card__stock">{t('catalog.card.stock', { n: row.stock_qty })}</p>
      </div>
      <div className="ct-card__actions">
        <button type="button" className="btn btn--sm" aria-label={t('catalog.page.editLabel', { name })} onClick={() => onEdit(row.id)}>
          {t('catalog.page.edit')}
        </button>
        <ActiveButton row={row} name={name} groupActive={groupActive} />
      </div>
    </article>
  );
}
