import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/ui/toast-context';
import { useRefreshCatalog } from './catalog.api';
import type { CatalogRow } from './catalog-rows';
import { useItemActive } from './use-item-active';

// Nút "Tạm ngưng" (trung tính, đỏ khi rê/focus) / "Dùng lại" của thẻ lưới và dòng bảng: cùng hành vi công tắc món
// trong panel nhóm (khóa khi nhóm ngừng) nhưng luôn hỏi xác nhận cả hai chiều
export function ItemActiveButton({ row, name, groupActive, quietHint = false }: { row: CatalogRow; name: string; groupActive: boolean; quietHint?: boolean }) {
  const { t } = useTranslation();
  const refresh = useRefreshCatalog();
  const toast = useToast();
  const hintId = useId();
  const { checked, locked, error, send } = useItemActive({ item: row, name, groupActive, refresh, notify: toast.show, confirmEach: true });
  return (
    <>
      <button
        type="button"
        className={checked ? 'btn btn--sm btn--danger-line' : 'btn btn--sm'}
        aria-label={t(checked ? 'catalog.grid.pauseFor' : 'catalog.grid.reactivateFor', { name })}
        aria-describedby={locked ? hintId : undefined}
        disabled={locked}
        onClick={() => void send(!checked)}
      >
        {t(checked ? 'catalog.grid.pause' : 'catalog.categories.reactivate')}
      </button>
      {locked && (
        <small id={hintId} className={quietHint ? 'sr-only' : 'ct-active__hint'}>
          {t('catalog.categories.enableGroupFirst')}
        </small>
      )}
      {error && (
        <span role="alert" className="ct-active__error">
          {error}
        </span>
      )}
    </>
  );
}
