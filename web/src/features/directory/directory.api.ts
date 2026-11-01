import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface DirectoryUser {
  sub: string;
  fullName: string | null;
  email: string | null;
  department: string | null;
  status: 'active' | 'locked';
}

interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

const USERS_KEY = ['users'] as const;
const PICKER_LIMIT = 8;

export const userLabel = (u: Pick<DirectoryUser, 'sub' | 'fullName'>) => u.fullName || u.sub;

export function useUserSearch(search: string, opts: { excludeAdmin?: boolean } = {}) {
  const excludeAdmin = opts.excludeAdmin ?? false;
  return useQuery({
    queryKey: [...USERS_KEY, 'search', search, excludeAdmin],
    queryFn: () => {
      const params = new URLSearchParams({ search, limit: String(PICKER_LIMIT) });
      if (excludeAdmin) params.set('exclude_admin', 'true');
      return apiFetch<Page<DirectoryUser>>(`/api/admin/users?${params}`);
    },
  });
}

export interface AdminUser extends DirectoryUser {
  employeeCode: string | null;
  groups: string[];
  lastLoginAt: string | null;
}

export interface SyncResult {
  created: number;
  updated: number;
}

export const USERS_PAGE = 200;

export function fetchUsersPage(search: string, cursor: string | null): Promise<Page<AdminUser>> {
  const params = new URLSearchParams({ limit: String(USERS_PAGE) });
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);
  return apiFetch(`/api/admin/users?${params}`);
}

export const syncDirectory = (csrfToken: string | null) =>
  apiFetch<SyncResult>('/api/admin/directory/sync', { method: 'POST', csrfToken });
