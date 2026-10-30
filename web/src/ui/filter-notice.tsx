import { useTranslation } from 'react-i18next';

export function FilterNotice({ label, count, onClear }: { label: string; count: number; onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="filter-notice">
      <span>{t('common.filter.active', { label, count })}</span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
        {t('common.filter.clear')}
      </button>
    </div>
  );
}
