import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { stockListQuery } from '@/features/stock/stock.api';
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

// Cột đã có tiêu đề "Tủ": ô chỉ ghi số (chữ "Tủ:" chỉ cần ở thẻ lưới, nơi không có tiêu đề cột)
// Trạng thái tủ lấy từ GET admin/stock — cùng luật "Sắp hết" với Tủ/Kho (server), web không tự tính
export function StockCell({ row }: { row: CatalogRow }) {
  const { t } = useTranslation();
  const stock = useQuery(stockListQuery());
  const state = stock.data?.find((f) => f.item_id === row.id)?.stock_state;
  return (
    <span className="ct-stock-cell">
      <span className="ct-stock num">{row.stock_qty}</span>
      {state === 'low' && <span className="tag tag--warn tag--sm">{t('catalog.list.stockLow')}</span>}
      {state === 'none' && <span className="tag tag--danger tag--sm">{t('catalog.list.stockOut')}</span>}
    </span>
  );
}
