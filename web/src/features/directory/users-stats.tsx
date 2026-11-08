import { useTranslation } from 'react-i18next';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { UsersFilter } from './users-rows';

interface RegCard {
  month: number;
  // null: đang tải hoặc lỗi → ô ghi "—"
  count: number | null;
  pressed: boolean;
  onClick: () => void;
}

export function UsersStats({ stats, filter, onFilter, reg }: { stats: Record<UsersFilter, number>; filter: UsersFilter | null; onFilter: (f: UsersFilter) => void; reg: RegCard | null }) {
  const { t } = useTranslation();
  return (
    <StatRow>
      <StatCard label={t('users.stats.active')} icon="users" value={stats.active} unit={t('users.stats.people')} pressed={filter === 'active'} onClick={() => onFilter('active')} />
      {reg && (
        <StatCard
          label={t('users.reg.no', { month: reg.month })}
          icon="clock"
          value={reg.count ?? t('common.empty')}
          unit={reg.count === null ? undefined : t('users.stats.people')}
          tone="warn"
          pressed={reg.pressed}
          onClick={reg.onClick}
        />
      )}
      <StatCard
        label={t('users.stats.locked')}
        icon="lock"
        value={stats.locked}
        unit={t('users.stats.people')}
        tone={stats.locked > 0 ? 'danger' : 'neutral'}
        pressed={filter === 'locked'}
        onClick={() => onFilter('locked')}
      />
      <StatCard
        label={t('users.stats.no_access')}
        icon="lock"
        value={stats.no_access}
        unit={t('users.stats.people')}
        tone={stats.no_access > 0 ? 'danger' : 'neutral'}
        pressed={filter === 'no_access'}
        onClick={() => onFilter('no_access')}
      />
    </StatRow>
  );
}

