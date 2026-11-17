import { useTranslation } from 'react-i18next';
import { BulkBar } from '@/ui/bulk-bar';
import type { CatalogTab } from './catalog-tabs';

export interface CatalogBulkBarProps {
  tab: CatalogTab;
  count: number;
  pending: boolean;
  // Số món đã chọn đổi được theo từng chiều; locked = món của nhóm tạm ngưng
  scope: { pause: number; resume: number; locked: number };
  onReactivate: () => void;
  onMove: () => void;
  onMax: () => void;
  onPause: () => void;
  onClear: () => void;
}

// "Dùng lại (n)" / "Tạm ngưng (n)" theo nội dung lựa chọn; tab Tạm ngưng không có "Đổi tối đa"
export function CatalogBulkBar({ tab, count, pending, scope, onReactivate, onMove, onMax, onPause, onClear }: CatalogBulkBarProps) {
  const { t } = useTranslation();
  return (
    <BulkBar count={count} label={t('catalog.stats.items')} variant="light" sticky onClear={onClear}>
      {scope.resume > 0 && (
        <button type="button" className="btn btn--sm btn--primary" disabled={pending} onClick={onReactivate}>
          {t('catalog.bulk.reactivateN', { n: scope.resume })}
        </button>
      )}
      {tab !== 'inactive' && (
        <button type="button" className="btn btn--sm" disabled={pending} onClick={onMax}>
          {t('catalog.bulk.max')}
        </button>
      )}
      <button type="button" className="btn btn--sm" disabled={pending} onClick={onMove}>
        {t('catalog.bulk.move')}
      </button>
      {scope.pause > 0 && (
        <button type="button" className="btn btn--sm btn--danger-line" disabled={pending} onClick={onPause}>
          {t('catalog.bulk.pauseN', { n: scope.pause })}
        </button>
      )}
      {scope.locked > 0 && <small className="ct-bulk__hint">{t('catalog.categories.enableGroupFirst')}</small>}
    </BulkBar>
  );
}
