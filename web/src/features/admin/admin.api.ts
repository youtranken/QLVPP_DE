import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface AdminUser {
  sub: string;
  email: string | null;
  employeeCode: string | null;
  fullName: string | null;
  department: string | null;
  groups: string[];
  status: 'active' | 'locked';
  lastLoginAt: string | null;
}

export interface SyncResult {
  created: number;
  updated: number;
}

export interface AuditEntry {
  id: string;
  actor: string;
  actorName: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  detail: unknown;
  createdAt: string;
}

export interface AuditFilters {
  actor: string;
  action: string;
  from: string;
  to: string;
}

export const NO_FILTERS: AuditFilters = { actor: '', action: '', from: '', to: '' };

export interface Signers {
  preparer: string;
  head: string;
  approver: string;
}

export interface AdminConfig {
  registration_last_day: number;
  default_max_qty: number;
  admin_group: string;
  authorized_groups: string[];
  low_stock_notify: boolean;
  signers: Signers;
  admin_contact: string;
}

export type ConfigPatch = Partial<Omit<AdminConfig, 'authorized_groups' | 'signers'>> & { signers?: Signers };

export const CONFIG_KEY = ['admin', 'config'] as const;
const USERS_PAGE = 50;
const AUDIT_PAGE = 50;

function pageParams(limit: number, cursor: string | null, extra: Record<string, string>) {
  const params = new URLSearchParams({ limit: String(limit) });
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  if (cursor) params.set('cursor', cursor);
  return params;
}

export function useAdminUsers(search: string) {
  return useInfiniteQuery({
    queryKey: ['users', 'admin-list', search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<Page<AdminUser>>(`/api/admin/users?${pageParams(USERS_PAGE, pageParam, { search })}`),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export const syncDirectory = (csrfToken: string | null) =>
  apiFetch<SyncResult>('/api/admin/directory/sync', { method: 'POST', csrfToken });

export function useAuditLog(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: ['audit', filters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<Page<AuditEntry>>(`/api/admin/audit?${pageParams(AUDIT_PAGE, pageParam, { ...filters })}`),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function useAdminConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => apiFetch<AdminConfig>('/api/admin/config'),
  });
}

export const saveConfig = (patch: ConfigPatch, csrfToken: string | null) =>
  apiFetch<AdminConfig>('/api/admin/config', { method: 'PUT', body: JSON.stringify(patch), csrfToken });
