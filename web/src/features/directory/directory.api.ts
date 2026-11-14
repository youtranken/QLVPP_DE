import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface DirectoryUser {
  sub: string;
  fullName: string | null;
  email: string | null;
  department: string | null;
  status: 'active' | 'locked' | 'no_access' | 'deleted';
}

interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

const USERS_KEY = ['users'] as const;
const PICKER_LIMIT = 8;

export const userLabel = (u: Pick<DirectoryUser, 'sub' | 'fullName'>) => u.fullName || u.sub;

export function useUserSearch(search: string) {
  return useQuery({
    queryKey: [...USERS_KEY, 'search', search],
    queryFn: () => {
      const params = new URLSearchParams({ search, limit: String(PICKER_LIMIT) });
      return apiFetch<Page<DirectoryUser>>(`/api/admin/users?${params}`);
    },
  });
}

export interface AdminUser extends Omit<DirectoryUser, 'status'> {
  status: 'active' | 'locked' | 'no_access' | 'deleted';
  employeeCode: string | null;
  team: string | null;
  role: 'admin' | 'member';
  lastLoginAt: string | null;
}

export interface SyncResult {
  created: number;
  updated: number;
  no_access: number;
  reconcile: 'ok' | 'skipped' | 'aborted';
}

export const USERS_PAGE = 200;

// Không gửi = mọi người trừ đã xóa
export type UsersListStatus = 'all' | 'active' | 'locked' | 'no_access' | 'deleted';

export function fetchUsersPage(search: string, cursor: string | null, status?: UsersListStatus): Promise<Page<AdminUser>> {
  const params = new URLSearchParams({ limit: String(USERS_PAGE) });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);
  return apiFetch(`/api/admin/users?${params}`);
}

export const syncDirectory = (csrfToken: string | null) =>
  apiFetch<SyncResult>('/api/admin/directory/sync', { method: 'POST', csrfToken });

export interface DirectorySyncStatus {
  last_at: string | null;
  last_total: number | null;
  last_error: { at: string; code: string; message: string } | null;
}

export const fetchSyncStatus = () => apiFetch<DirectorySyncStatus>('/api/admin/directory/status');
