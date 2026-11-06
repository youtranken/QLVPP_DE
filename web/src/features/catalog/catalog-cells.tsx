import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { Switch } from '@/ui/switch';
import type { CatalogRow } from './catalog-rows';

// Ô có nút/ô nhập: chặn bấm lan lên hàng (bấm hàng = mở form món)
export function Stop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </span>
  );
}

export function ItemCell({ row, error }: { row: CatalogRow; error?: string }) {
  const { t } = useTranslation();
  return (
    <span className="ct-item">
      <ItemThumb fileId={row.image_file_id} alt={row.name} tone={row.tone} size={36} />
      <span className="ct-item__text">
        <span className="ct-item__line">
          <span className="ct-item__name">{row.name}</span>
          {row.admin_only && <span className="tag tag--dark">{t('catalog.page.adminOnly')}</span>}
          {row.missing_image && <span className="tag tag--warn">{t('catalog.page.missingImage')}</span>}
          {row.inactive_reason === 'item' && <span className="tag tag--outline">{t('catalog.categories.byItem')}</span>}
          {row.inactive_reason === 'group' && <span className="tag tag--warn">{t('catalog.categories.byGroup')}</span>}
        </span>
        {row.pack_note && <small className="ct-item__note">{row.pack_note}</small>}
        {error && (
          <span className="ct-item__error" role="alert">
            {error}
          </span>
        )}
      </span>
    </span>
  );
}

export function CodeCell({ code }: { code: string | null }) {
  const { t } = useTranslation();
  if (!code) return <>{t('common.empty')}</>;
  return (
    <span className="ct-code__text" title={code}>
      {code}
    </span>
  );
}

export function StockCell({ row }: { row: CatalogRow }) {
  const { t } = useTranslation();
  return <span className="ct-stock">{t('catalog.card.stock', { n: row.stock_qty })}</span>;
}

// Món ngừng theo nhóm: công tắc tắt và khóa như trong panel nhóm, bật lại nhóm mới đổi được từng món
export function ActiveCell({ row, onToggle }: { row: CatalogRow; onToggle: () => void }) {
  const { t } = useTranslation();
  const hintId = useId();
  const byGroup = row.inactive_reason === 'group';
  const on = row.active && !byGroup;
  return (
    <Stop>
      <Switch
        checked={on}
        label={t(on ? 'catalog.list.deactivateLabel' : 'catalog.list.reactivateLabel', { name: row.name })}
        disabled={byGroup}
        describedBy={byGroup ? hintId : undefined}
        onChange={onToggle}
      />
      {byGroup && (
        <span id={hintId} className="sr-only">
          {t('catalog.categories.enableGroupFirst')}
        </span>
      )}
    </Stop>
  );
}
