import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CurrentPeriod } from '@/features/request/request.api';
import { vnLockDate } from '@/lib/format-time';

export function AdminPeriodCard({ period, onNavigate }: { period: CurrentPeriod; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const month = Number(period.ym.slice(5, 7));
  const date = vnLockDate(period.deadline);
  const title = t('nav.periodCard.title', { month });
  const detail = period.days_left <= 1 ? t('nav.periodCard.lastDay', { date }) : t('nav.periodCard.daysLeft', { n: period.days_left, date });
  return (
    <Link to="/admin/summary" className="side__period" data-last={period.days_left <= 1 || undefined} title={`${title} · ${detail}`} onClick={onNavigate}>
      <span className="side__period-dot" aria-hidden="true" />
      <span className="side__period-text">
        <b>{title}</b>
        <span>{detail}</span>
      </span>
    </Link>
  );
}
