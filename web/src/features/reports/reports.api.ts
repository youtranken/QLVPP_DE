import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from '@/lib/api-client';

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

// Tải qua fetch để 401 tự đăng nhập lại và lỗi không thành tệp rác; tên tệp theo server, thiếu thì dự phòng theo tháng
export async function downloadSnapshot(id: string, lang: string, ym: string) {
  const { blob, fileName } = await apiFetchBlob(`/api/admin/reports/snapshots/${id}/export.xlsx?lang=${lang === 'en' ? 'en' : 'vi'}`);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName ?? `vpp-bao-cao-${ym}.xlsx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

export const pickName = (lang: string, name: string, nameEn: string | null) => (lang === 'en' && nameEn ? nameEn : name);
