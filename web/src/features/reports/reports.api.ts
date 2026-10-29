import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export const ORDER_QTY_MAX = 99999;

export interface ReportItemRow {
  key: string;
  item_id: string;
  name: string;
  name_en: string | null;
  unit: string;
  requested: number;
  backlog_prev: number;
  stock: number;
  need: number;
}

export interface ReportCustomRow {
  key: string;
  name: string;
  unit: string;
  requested: number;
  backlog_prev: number;
  stock: null;
  need: number;
  people: number;
}

export interface ReportDepartment {
  department: string | null;
  people: {
    user_sub: string;
    full_name: string | null;
    lines: { name: string; name_en: string | null; unit: string; qty: number }[];
  }[];
}

export interface ReportIssue {
  item_name: string;
  item_name_en: string | null;
  unit: string;
  recipient_sub: string | null;
  recipient_name: string | null;
  qty: number;
  reason: string;
  at: string;
}

export interface MonthReport {
  ym: string;
  byItem: ReportItemRow[];
  custom: ReportCustomRow[];
  byDepartment: ReportDepartment[];
  issues: ReportIssue[];
  pending_custom_count: number;
}

export type SnapshotKind = 'xlsx' | 'print';

export interface SnapshotRow {
  id: string;
  kind: SnapshotKind;
  created_at: string;
  created_by_sub: string;
  created_by_name: string | null;
}

const REPORTS_KEY = ['reports'] as const;
const snapshotsKey = (ym: string) => [...REPORTS_KEY, ym, 'snapshots'];

export function useMonthReport(ym: string) {
  return useQuery({
    queryKey: [...REPORTS_KEY, ym],
    queryFn: () => apiFetch<MonthReport>(`/api/admin/reports/${ym}`),
  });
}

export function useSnapshots(ym: string) {
  return useQuery({
    queryKey: snapshotsKey(ym),
    queryFn: () => apiFetch<{ items: SnapshotRow[] }>(`/api/admin/reports/${ym}/snapshots`),
  });
}

export function useRefreshSnapshots(ym: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: snapshotsKey(ym) });
}

export const createSnapshot = (ym: string, body: { kind: SnapshotKind; order_qty: Record<string, number> }, csrfToken: string | null) =>
  apiFetch<{ id: string }>(`/api/admin/reports/${ym}/snapshots`, { method: 'POST', body: JSON.stringify(body), csrfToken });

export const printPath = (id: string) => `/admin/reports/snapshots/${id}/print`;

// Tệp tải qua cookie phiên của trình duyệt; Content-Disposition attachment nên trang không rời đi
export function downloadSnapshot(id: string, lang: string) {
  const a = document.createElement('a');
  a.href = `/api/admin/reports/snapshots/${id}/export.xlsx?lang=${lang === 'en' ? 'en' : 'vi'}`;
  a.download = '';
  document.body.append(a);
  a.click();
  a.remove();
}

export const pickName = (lang: string, name: string, nameEn: string | null) => (lang === 'en' && nameEn ? nameEn : name);
