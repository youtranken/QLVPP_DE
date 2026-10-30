import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CurrentPeriod } from '@/features/request/request.api';

const ZONE = 'Asia/Ho_Chi_Minh';

// Hạn là mốc 00:00 ngày khóa theo giờ VN: in đúng ngày của mốc đó
function lockDate(deadline: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric', timeZone: ZONE }).formatToParts(new Date(deadline));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}`;
}

export function AdminPeriodCard({ period }: { period: CurrentPeriod }) {
  const { t } = useTranslation();
  const month = Number(period.ym.slice(5, 7));
  const date = lockDate(period.deadline);
  const title = t('nav.periodCard.title', { month });
  const detail = period.days_left <= 1 ? t('nav.periodCard.lastDay', { date }) : t('nav.periodCard.daysLeft', { n: period.days_left, date });
  return (
    <Link to="/admin/summary" className="side__period" data-last={period.days_left <= 1 || undefined} title={`${title} · ${detail}`}>
      <span className="side__period-dot" aria-hidden="true" />
      <span className="side__period-text">
        <b>{title}</b>
        <span>{detail}</span>
      </span>
    </Link>
  );
}
