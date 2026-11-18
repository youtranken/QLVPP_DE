import { useTranslation } from 'react-i18next';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { StatFilter } from './users-rows';

export type UsersStatKey = StatFilter | 'reg';

interface RegCard {
  month: number;
  // null: đang tải hoặc lỗi → ô ghi "—"
  count: number | null;
}

export function UsersStats({ stats, selected, onSelect, reg }: { stats: Record<StatFilter, number>; selected: UsersStatKey | null; onSelect: (key: UsersStatKey) => void; reg: RegCard | null }) {
  const { t } = useTranslation();
  const people = t('users.stats.people');
  return (
    <StatRow label={t('users.stats.label')} selected={selected ?? ''} onSelect={(k) => onSelect(k as UsersStatKey)}>
      <StatCard filterKey="active" label={t('users.stats.active')} icon="users" value={stats.active} unit={people} />
      {reg && (
        <StatCard
          filterKey="reg"
          label={t('users.reg.no', { month: reg.month })}
          icon="clock"
          value={reg.count ?? t('common.empty')}
          unit={reg.count === null ? undefined : people}
          tone="warn"
        />
      )}
      <StatCard filterKey="locked" label={t('users.stats.locked')} icon="lock" value={stats.locked} unit={people} tone="danger" />
      {/* Mất quyền là việc của Tài khoản D&E (gỡ app), không phải tài khoản bị khóa: màu khác Đã khóa để hai thẻ không lẫn */}
      <StatCard filterKey="no_access" label={t('users.stats.no_access')} icon="x" value={stats.no_access} unit={people} tone="info" />
    </StatRow>
  );
}
