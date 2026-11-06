import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from '@/lib/api-client';

export const ORDER_QTY_MAX = 99999;

// Tên ĐVT chụp lúc chốt; báo cáo sống và bản chốt cũ không có
export interface FrozenUnitName {
  unit_name?: string;
  unit_name_en?: string | null;
}

export interface ReportItemRow extends FrozenUnitName {
  key: string;
  item_id: string;
  code?: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  requested: number;
  backlog_prev: number;
  stock: number;
  /** @deprecated số net cũ, không hiển thị, không là số mặc định */
  need: number;
  // Bản chốt cũ thiếu ba trường dưới → đọc như số gộp
  adm_owed?: number;
  left_excluded?: number;
  usable?: boolean;
}

export interface ReportCustomRow extends FrozenUnitName {
  key: string;
  name: string;
  unit: string;
  requested: number;
  backlog_prev: number;
  stock: null;
  /** @deprecated số net cũ, không hiển thị, không là số mặc định */
  need: number;
  people: number;
  adm_owed?: number;
  left_excluded?: number;
  usable?: boolean;
}

export interface ReportDepartment {
  department: string | null;
  people: {
    user_sub: string;
    full_name: string | null;
    lines: ({ name: string; name_en: string | null; unit: string; qty: number } & FrozenUnitName)[];
  }[];
}

export interface ReportIssue extends FrozenUnitName {
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
  // Cột sống của kỳ (chỉ báo cáo sống, không có trong bản chốt)
  progress?: Record<string, KeyProgress>;
}

export interface KeyProgress {
  registered: number;
  delivered: number;
  received: number;
}

export interface OrderBasis {
  requested: number;
  debt: number;
  adm_owed: number;
  left_excluded: number;
  discontinued: boolean;
}

export interface SnapshotRef {
  id: string;
  created_at: string;
}

export interface SnapshotData extends MonthReport {
  id: string;
  kind: SnapshotKind;
  period_ym: string;
  order_qty: Record<string, number>;
  order_basis?: Record<string, OrderBasis>;
  replaces?: SnapshotRef;
  signature_boxes?: { title: string; title_en: string; name: string }[];
  signers?: { preparer: string; head: string; approver: string };
  created_by: { sub: string; name: string | null };
  created_at: string;
}

export type SnapshotKind = 'xlsx' | 'print';

export interface SnapshotRow {
  id: string;
  kind: SnapshotKind;
  created_at: string;
  created_by_sub: string;
  created_by_name: string | null;
}

export const REPORTS_KEY = ['reports'] as const;
const snapshotsKey = (ym: string) => [...REPORTS_KEY, ym, 'snapshots'];

export function useMonthReport(ym: string) {
  return useQuery({
    queryKey: [...REPORTS_KEY, ym],
    queryFn: () => apiFetch<MonthReport>(`/api/admin/reports/${ym}`),
  });
}

// Tải lại báo cáo và trả bản mới (để biết dòng nào đã biến mất)
export function useReloadReport(ym: string) {
  const qc = useQueryClient();
  const key = [...REPORTS_KEY, ym];
  return async () => {
    await qc.refetchQueries({ queryKey: key, exact: true });
    return qc.getQueryData<MonthReport>(key);
  };
}

export function useSnapshot(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...REPORTS_KEY, 'snapshot', id],
    queryFn: () => apiFetch<SnapshotData>(`/api/admin/reports/snapshots/${id}`),
    enabled,
    retry: false,
    staleTime: Infinity,
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

export interface SnapshotBody {
  kind: SnapshotKind;
  order_qty: Record<string, number>;
  reuse_if_unchanged?: boolean;
}

export const createSnapshot = (ym: string, body: SnapshotBody, csrfToken: string | null) =>
  apiFetch<{ id: string; created_at: string; reused?: boolean; data?: SnapshotData }>(`/api/admin/reports/${ym}/snapshots`, { method: 'POST', body: JSON.stringify(body), csrfToken });

export const printPath = (id: string) => `/admin/reports/snapshots/${id}/print`;

// Firefox/Safari đọc blob sau click một lúc: thu hồi sớm làm hỏng tải
const REVOKE_AFTER_MS = 10_000;

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
  setTimeout(() => URL.revokeObjectURL(href), REVOKE_AFTER_MS);
}

export const pickName = (lang: string, name: string, nameEn: string | null) => (lang === 'en' && nameEn ? nameEn : name);
