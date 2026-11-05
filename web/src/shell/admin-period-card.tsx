import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/ui/progress';
import type { CurrentPeriod } from '@/features/request/request.api';
import { periodSummaryQuery } from '@/features/summary/summary.api';
import { vnLockDate } from '@/lib/format-time';

export function AdminPeriodCard({ period, onNavigate }: { period: CurrentPeriod; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const summary = useQuery(periodSummaryQuery(period.ym));
  const month = Number(period.ym.slice(5, 7));
  const date = vnLockDate(period.deadline);
  const detail = period.days_left <= 1 ? t('nav.periodCard.lastDay', { date }) : t('nav.periodCard.daysLeft', { n: period.days_left, date });
  const name = t('nav.periodCard.name', { month, detail });
  const registered = summary.data?.registered;
  const headcount = summary.data?.headcount;
  const showBar = typeof registered === 'number' && typeof headcount === 'number' && headcount > 0;
  return (
    <Link to="/admin/summary" className="side__period" data-last={period.days_left <= 1 || undefined} aria-label={name} title={name} onClick={onNavigate}>
      <span className="side__period-dot" aria-hidden="true" />
      <span className="side__period-text">
        <b>{t('nav.periodCard.title', { month })}</b>
        {showBar && <Progress done={registered} total={headcount} label={t('nav.periodCard.registered', { registered, headcount })} />}
        <span>{detail}</span>
      </span>
    </Link>
  );
}
