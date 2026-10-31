import { useTranslation } from 'react-i18next';
import { vnLockDate } from '@/lib/format-time';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { PeriodSummary } from './summary.api';
import type { PageFilter } from './use-summary-params';

interface Props {
  summary: PeriodSummary;
  outCount: number;
  filter: PageFilter | null;
  onFilter: (filter: PageFilter) => void;
}

// Mẫu số = headcount server trả (kỳ cũ có thể < registered); "chưa đăng ký" lấy `unregistered`, không lấy hiệu
export function SummaryStats({ summary, outCount, filter, onFilter }: Props) {
  const { t } = useTranslation();
  const source = t(summary.headcount_source === 'snapshot' ? 'summary.kpi.headcountSnapshot' : 'summary.kpi.headcountLive');
  const ratio = summary.headcount > 0 ? summary.registered / summary.headcount : 0;
  return (
    <StatRow>
      <StatCard
        label={t('summary.kpi.registered')}
        icon="users"
        value={`${summary.registered}/${summary.headcount}`}
        unit={t('summary.kpi.people')}
        sub={`${source} · ${t('summary.kpi.unregistered', { n: summary.unregistered })}`}
        meter={ratio}
        pressed={filter === 'unregistered'}
        onClick={() => onFilter('unregistered')}
      />
      {summary.is_open ? (
        <StatCard
          label={t('summary.kpi.pendingDelivery')}
          icon="truck"
          value="—"
          sub={summary.deadline ? t('summary.kpi.pendingOpen', { date: vnLockDate(summary.deadline) }) : undefined}
        />
      ) : (
        <StatCard
          label={t('summary.kpi.pendingDelivery')}
          icon="truck"
          value={summary.lines_pending_delivery}
          unit={t('summary.kpi.lines')}
          sub={t('summary.kpi.pendingDeliveryHint')}
          pressed={filter === 'pending_delivery'}
          onClick={() => onFilter('pending_delivery')}
        />
      )}
      <StatCard
        label={t('summary.kpi.customPending')}
        icon="pkgplus"
        value={summary.custom_pending}
        unit={t('summary.kpi.items')}
        sub={t('summary.kpi.customPendingHint')}
        tone={summary.custom_pending > 0 ? 'warn' : 'neutral'}
        pressed={filter === 'custom_pending'}
        onClick={() => onFilter('custom_pending')}
      />
      <StatCard
        label={t('summary.kpi.lowStock')}
        icon="warehouse"
        value={summary.low_stock}
        unit={t('summary.kpi.items')}
        sub={t('summary.kpi.outStock', { n: outCount })}
        tone={outCount > 0 ? 'danger' : 'neutral'}
        pressed={filter === 'low'}
        onClick={() => onFilter('low')}
      />
    </StatRow>
  );
}
