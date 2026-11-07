import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  count: number;
  label: string;
  onClear: () => void;
  variant?: 'dark' | 'light';
  className?: string;
  children?: ReactNode;
}

export function BulkBar({ count, label, onClear, variant = 'dark', className, children }: Props) {
  const { t } = useTranslation();
  if (count < 1) return null;
  const light = variant === 'light';
  return (
    <div role="toolbar" aria-label={t('common.table.bulkLabel')} className={['bulk-bar', light ? 'bulk-bar--light' : '', className ?? ''].filter(Boolean).join(' ')}>
      <b>{t('common.table.selected', { count, label })}</b>
      {children}
      <button type="button" className={light ? 'btn btn--ghost btn--sm' : 'bulk-bar__clear'} onClick={onClear}>
        {t('common.table.clearSelection')}
      </button>
    </div>
  );
}
