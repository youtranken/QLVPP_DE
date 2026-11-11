import { matchesSearch } from '@/features/request/request-format';
import type { AdminUser } from './directory.api';

// Ba thẻ thống kê; 'deleted' chỉ là bộ lọc xem người đã xoá (ẩn mặc định, không có thẻ)
export const USERS_FILTERS = ['active', 'locked', 'no_access'] as const;
export type StatFilter = (typeof USERS_FILTERS)[number];
export type UsersFilter = StatFilter | 'deleted';
export type RegFilter = 'yes' | 'no';

export interface UsersView {
  filter: UsersFilter | null;
  reg: RegFilter | null;
  dept: string;
  q: string;
}

// Tập người của kỳ đang mở: đã có phiếu / chưa; người ngoài cả hai không thuộc danh sách kỳ
export interface RegSets {
  registered: ReadonlySet<string>;
  unregistered: ReadonlySet<string>;
}

export const parseUsersFilter = (raw: string | null): UsersFilter | null => (raw === 'deleted' || USERS_FILTERS.includes(raw as StatFilter) ? (raw as UsersFilter) : null);
export const parseRegFilter = (raw: string | null): RegFilter | null => (raw === 'yes' || raw === 'no' ? raw : null);

export function regOf(u: Pick<AdminUser, 'sub'>, sets: RegSets): RegFilter | null {
  if (sets.registered.has(u.sub)) return 'yes';
  return sets.unregistered.has(u.sub) ? 'no' : null;
}

const MATCH: Record<UsersFilter, (u: AdminUser) => boolean> = {
  active: (u) => u.status === 'active',
  locked: (u) => u.status === 'locked',
  no_access: (u) => u.status === 'no_access',
  deleted: (u) => u.status === 'deleted',
};

export function usersStats(users: AdminUser[]): Record<StatFilter, number> {
  const stats = { active: 0, locked: 0, no_access: 0 };
  for (const u of users) for (const f of USERS_FILTERS) if (MATCH[f](u)) stats[f] += 1;
  return stats;
}

export function departmentsOf(users: AdminUser[]): string[] {
  const set = new Set<string>();
  for (const u of users) if (u.department) set.add(u.department);
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
}

// Danh bạ và ô chọn người (Xuất lẻ, lọc Nhật ký) tìm cùng một bộ trường, gõ không dấu vẫn ra
export const searchText = (u: AdminUser) => [u.fullName, u.email, u.department, u.employeeCode, u.team, u.sub].filter(Boolean).join(' ');

// clientSearch=false: server đã lọc theo `search`, trang chỉ lọc thẻ và phòng ban; lọc đăng ký chưa có dữ liệu → chưa ra ai
export function applyUsersView(users: AdminUser[], view: UsersView, clientSearch: boolean, reg: RegSets | null = null): AdminUser[] {
  return users.filter(
    (u) =>
      (!view.filter || MATCH[view.filter](u)) &&
      (!view.reg || (!!reg && regOf(u, reg) === view.reg)) &&
      (!view.dept || u.department === view.dept) &&
      (!clientSearch || !view.q || matchesSearch(searchText(u), view.q)),
  );
}

export const nameOf = (u: Pick<AdminUser, 'sub' | 'fullName'>) => u.fullName || u.sub;
