import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function BulkBar({ count, label, onClear, children }: { count: number; label: string; onClear: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  if (count < 1) return null;
  return (
    <div role="toolbar" aria-label={t('common.table.bulkLabel')} className="bulk-bar">
      <b>{t('common.table.selected', { count, label })}</b>
      {children}
      <button type="button" className="bulk-bar__clear" onClick={onClear}>
        {t('common.table.clearSelection')}
      </button>
    </div>
  );
}
