import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface AuditObjectLabel {
  name: string | null;
  ym: string | null;
  owner: string | null;
}

export interface AuditEntry {
  id: string;
  actor: string;
  actorName: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  objectLabel?: AuditObjectLabel | null;
  detail: unknown;
  createdAt: string;
  // Dòng gộp một lần Lưu hàng về
  batch?: AuditBatch;
}

export interface AuditBatch {
  ym: string;
  units: number;
  items: { item_id: string; name: string; name_en: string | null; qty: number }[];
}

export interface AuditFilters {
  actor: string;
  action: string;
  from: string;
  to: string;
}

export const NO_FILTERS: AuditFilters = { actor: '', action: '', from: '', to: '' };

export interface SignatureBox {
  title: string;
  title_en: string;
  name: string;
}

export interface AdminConfig {
  registration_last_day: number;
  reminder_days_left: number;
  default_max_qty: number;
  signature_boxes: SignatureBox[];
}

export type ConfigPatch = Partial<AdminConfig>;

export const CONFIG_KEY = ['admin', 'config'] as const;
const AUDIT_PAGE = 50;

function pageParams(limit: number, cursor: string | null, extra: Record<string, string>) {
  const params = new URLSearchParams({ limit: String(limit) });
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  if (cursor) params.set('cursor', cursor);
  return params;
}

export function useAuditLog(filters: AuditFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['audit', filters],
    enabled,
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
