import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
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
          <span className={row.usable ? 'ct-item__name' : 'ct-item__name ct-item__name--paused'}>{row.name}</span>
          {!row.usable && <span className="ct-item__paused">{t('common.paused')}</span>}
          {row.admin_only && <span className="tag tag--dark">{t('catalog.page.adminOnly')}</span>}
          {row.missing_image && <span className="tag tag--warn">{t('catalog.page.missingImage')}</span>}
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
