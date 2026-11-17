import { useTranslation } from 'react-i18next';
import { useRequestFormat } from '@/features/request/request-format';
import type { UserHistorySummary } from './summary.api';

export function OrderHistorySummary({ summary }: { summary: UserHistorySummary }) {
  const { t, i18n } = useTranslation();
  const fmt = useRequestFormat();
  if (!summary.top_item) return <p className="oh-summary">{t('summary.history.summaryNone', { months: summary.months })}</p>;
  const avg = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(summary.avg_units);
  return (
    <p className="oh-summary">
      <span>
        {t('summary.history.avgLabel', { months: summary.months })} <b>{t('summary.history.avgValue', { avg })}</b>
      </span>
      <span>
        {t('summary.history.topLabel')} <b>{fmt.name(summary.top_item)}</b>
      </span>
    </p>
  );
}
