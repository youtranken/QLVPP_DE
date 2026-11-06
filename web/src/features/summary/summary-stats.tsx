import { useTranslation } from 'react-i18next';
import { vnLockDate } from '@/lib/format-time';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { PeriodSummary } from './summary.api';
import type { PageFilter } from './use-summary-params';

interface Props {
  summary: PeriodSummary;
  stock: { out: number; low: number } | undefined;
  filter: PageFilter | null;
  onFilter: (filter: PageFilter) => void;
}

// Mẫu số = headcount server trả (kỳ cũ là số lúc khóa, có thể < registered); "chưa đăng ký" lấy `unregistered`, không lấy hiệu
export function SummaryStats({ summary, stock, filter, onFilter }: Props) {
  const { t } = useTranslation();
  const ratio = summary.headcount > 0 ? summary.registered / summary.headcount : 0;
  return (
    <>
      <StatRow>
        <StatCard
          label={t(summary.headcount_source === 'snapshot' ? 'summary.kpi.registeredAtLock' : 'summary.kpi.registered')}
          icon="users"
          value={`${summary.registered}/${summary.headcount}`}
          unit={t('summary.kpi.people')}
          sub={t('summary.kpi.unregistered', { n: summary.unregistered })}
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
        {summary.custom_pending === null ? (
          <StatCard label={t('summary.kpi.customPending')} icon="pkgplus" value="—" />
        ) : (
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
        )}
        <StatCard
          label={t('summary.kpi.shortage')}
          icon="warehouse"
          value={stock ? stock.out + stock.low : '—'}
          unit={stock ? t('summary.kpi.items') : undefined}
          sub={stock ? t('summary.kpi.shortageSub', stock) : undefined}
          tone={stock && stock.out > 0 ? 'danger' : 'warn'}
          pressed={filter === 'low'}
          onClick={() => onFilter('low')}
        />
      </StatRow>
      {summary.outside > 0 && <p className="sm-note">{t('summary.outside', { n: summary.outside })}</p>}
    </>
  );
}
