import { useTranslation } from 'react-i18next';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import { USERS_FILTERS, type UsersFilter } from './users-rows';

const ICON = { active: 'users', never: 'clock', locked: 'lock' } as const;

export function UsersStats({ stats, filter, onFilter }: { stats: Record<UsersFilter, number>; filter: UsersFilter | null; onFilter: (f: UsersFilter) => void }) {
  const { t } = useTranslation();
  return (
    <StatRow>
      {USERS_FILTERS.map((f) => (
        <StatCard
          key={f}
          label={t(`users.stats.${f}`)}
          icon={ICON[f]}
          value={stats[f]}
          unit={t('users.stats.people')}
          tone={f === 'locked' && stats[f] > 0 ? 'danger' : 'neutral'}
          pressed={filter === f}
          onClick={() => onFilter(f)}
        />
      ))}
    </StatRow>
  );
}
