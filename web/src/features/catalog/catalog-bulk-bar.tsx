import { useTranslation } from 'react-i18next';
import { BulkBar } from '@/ui/bulk-bar';
import type { CatalogTab } from './catalog-tabs';

export interface CatalogBulkBarProps {
  tab: CatalogTab;
  count: number;
  pending: boolean;
  onReactivate: () => void;
  onMove: () => void;
  onMax: () => void;
  onPause: () => void;
  onClear: () => void;
}

// Thanh thao tác sáng, cùng hàng với tab: tab Tạm ngưng chỉ có Dùng lại / Chuyển nhóm, tab khác có Đổi tối đa / Chuyển nhóm / Tạm ngưng
export function CatalogBulkBar({ tab, count, pending, onReactivate, onMove, onMax, onPause, onClear }: CatalogBulkBarProps) {
  const { t } = useTranslation();
  return (
    <BulkBar count={count} label={t('catalog.stats.items')} variant="light" className="is-sticky-bottom" onClear={onClear}>
      {tab === 'inactive' ? (
        <>
          <button type="button" className="btn btn--sm btn--primary" disabled={pending} onClick={onReactivate}>
            {t('catalog.bulk.reactivate')}
          </button>
          <button type="button" className="btn btn--sm" disabled={pending} onClick={onMove}>
            {t('catalog.bulk.move')}
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn--sm" disabled={pending} onClick={onMax}>
            {t('catalog.bulk.max')}
          </button>
          <button type="button" className="btn btn--sm" disabled={pending} onClick={onMove}>
            {t('catalog.bulk.move')}
          </button>
          <button type="button" className="btn btn--sm btn--quiet-danger" disabled={pending} onClick={onPause}>
            {t('catalog.bulk.pause')}
          </button>
        </>
      )}
    </BulkBar>
  );
}
