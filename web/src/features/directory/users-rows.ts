import { matchesSearch } from '@/features/request/request-format';
import type { AdminUser } from './directory.api';

export const USERS_FILTERS = ['active', 'never', 'locked'] as const;
export type UsersFilter = (typeof USERS_FILTERS)[number];

export interface UsersView {
  filter: UsersFilter | null;
  dept: string;
  q: string;
}

export const parseUsersFilter = (raw: string | null): UsersFilter | null => (USERS_FILTERS.includes(raw as UsersFilter) ? (raw as UsersFilter) : null);

const MATCH: Record<UsersFilter, (u: AdminUser) => boolean> = {
  active: (u) => u.status === 'active',
  never: (u) => u.lastLoginAt === null,
  locked: (u) => u.status === 'locked',
};

export function usersStats(users: AdminUser[]): Record<UsersFilter, number> {
  const stats = { active: 0, never: 0, locked: 0 };
  for (const u of users) for (const f of USERS_FILTERS) if (MATCH[f](u)) stats[f] += 1;
  return stats;
}

export function departmentsOf(users: AdminUser[]): string[] {
  const set = new Set<string>();
  for (const u of users) if (u.department) set.add(u.department);
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
}

const searchText = (u: AdminUser) => [u.fullName, u.email, u.employeeCode, u.sub].filter(Boolean).join(' ');

// clientSearch=false: server đã lọc theo `search`, trang chỉ lọc thẻ và phòng ban
export function applyUsersView(users: AdminUser[], view: UsersView, clientSearch: boolean): AdminUser[] {
  return users.filter(
    (u) =>
      (!view.filter || MATCH[view.filter](u)) &&
      (!view.dept || u.department === view.dept) &&
      (!clientSearch || !view.q || matchesSearch(searchText(u), view.q)),
  );
}

export const nameOf = (u: Pick<AdminUser, 'sub' | 'fullName'>) => u.fullName || u.sub;
