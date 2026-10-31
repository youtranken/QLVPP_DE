import { useTranslation } from 'react-i18next';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { BacklogFilter, backlogStats } from './backlog-rows';

interface Props {
  stats: ReturnType<typeof backlogStats>;
  filter: BacklogFilter | null;
  onFilter: (filter: BacklogFilter) => void;
}

export function BacklogStats({ stats, filter, onFilter }: Props) {
  const { t } = useTranslation();
  return (
    <StatRow>
      <StatCard
        label={t('delivery.backlog.stats.total')}
        icon="receipt"
        value={stats.owed}
        unit={t('delivery.backlog.stats.unit')}
        sub={t('delivery.backlog.stats.totalSub', { lines: stats.lines, people: stats.people })}
      />
      <StatCard
        label={t('delivery.backlog.stats.available')}
        icon="truck"
        value={stats.available}
        unit={t('delivery.backlog.stats.lines')}
        sub={t('delivery.backlog.stats.availableSub')}
        pressed={filter === 'available'}
        onClick={() => onFilter('available')}
      />
      <StatCard
        label={t('delivery.backlog.stats.left')}
        icon="users"
        value={stats.left}
        unit={t('delivery.backlog.stats.lines')}
        sub={t('delivery.backlog.stats.leftSub')}
        tone={stats.left > 0 ? 'warn' : 'neutral'}
        pressed={filter === 'left'}
        onClick={() => onFilter('left')}
      />
    </StatRow>
  );
}
