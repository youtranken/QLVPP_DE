import { keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { RequestView } from '@/features/request/request.api';

export type SummaryFilter = 'all' | 'pending_delivery' | 'custom_pending' | 'over_max' | 'left';

export interface PeriodSummary {
  ym: string;
  deadline: string | null;
  is_open: boolean;
  registered: number;
  headcount: number;
  headcount_source: 'snapshot' | 'live';
  unregistered: number;
  outside: number;
  // Kỳ đang mở: server không trả số dòng (Hành chính chỉ thấy tiến độ đăng ký)
  lines_pending_delivery: number | null;
  custom_pending: number | null;
  low_stock: number;
  receipts: number;
}

export interface PersonRow {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  user_status: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  custom_pending: number;
  // Có dòng giữ số lớn hơn tối đa/tháng hiện tại (tối đa bị hạ sau khi lưu)
  over_max: boolean;
  updated_at: string;
  // Giờ nhân viên lưu phiếu ("Lưu lúc"); updated_at còn đổi theo việc Hành chính làm
  saved_at: string;
}

export interface ItemSummaryRow {
  key: string;
  item_id: string | null;
  name: string;
  unit: string;
  requested_qty: number;
  people: number;
  // Tối đa/tháng hiện tại; null với dòng ngoài DM
  max_qty: number | null;
  over_max: boolean;
}

export interface UnregisteredUser {
  sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

export interface RegistrationRow {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  team: string | null;
  line_count: number;
  total_qty: number;
  custom_count: number;
  saved_at: string;
}

export const SUMMARY_KEY = ['admin-summary'] as const;
const PERSON_PAGE = 100;
const base = (ym: string) => `/api/admin/periods/${ym}`;

export const periodSummaryQuery = (ym: string | undefined) =>
  queryOptions({
    queryKey: [...SUMMARY_KEY, ym, 'kpi'],
    enabled: !!ym,
    queryFn: () => apiFetch<PeriodSummary>(`${base(ym!)}/summary`),
  });

export function usePeriodSummary(ym: string | undefined) {
  return useQuery(periodSummaryQuery(ym));
}

export function usePersonRows(ym: string | undefined, filter: SummaryFilter, q: string) {
  return useInfiniteQuery({
    queryKey: [...SUMMARY_KEY, ym, 'person', filter, q],
    enabled: !!ym,
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ by: 'person', filter, limit: String(PERSON_PAGE) });
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<{ items: PersonRow[]; next_cursor: string | null }>(`${base(ym!)}/requests?${params}`);
    },
    getNextPageParam: (last) => last.next_cursor,
  });
}

// Người đã nghỉ còn phần chưa nhận ở kỳ khóa (nhắc ở Tháng này); trang đầu 100 người là đủ để nhắc
export function useLeftPeople(ym: string, enabled: boolean) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, ym, 'person', 'left-reminder'],
    enabled,
    queryFn: () => apiFetch<{ items: PersonRow[]; next_cursor: string | null }>(`${base(ym)}/requests?by=person&filter=left&limit=${PERSON_PAGE}`),
  });
}

export function useItemRows(ym: string | undefined) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, ym, 'item'],
    enabled: !!ym,
    queryFn: () => apiFetch<{ items: ItemSummaryRow[] }>(`${base(ym!)}/requests?by=item`),
  });
}

// registered_subs: cùng tập người của kỳ, đã có phiếu (api cũ không có → coi như rỗng)
export const fetchUnregistered = (ym: string) =>
  apiFetch<{ items: UnregisteredUser[]; registered_subs?: string[] }>(`${base(ym)}/unregistered`);

export function useUnregistered(ym: string | undefined) {
  return useQuery({ queryKey: [...SUMMARY_KEY, ym, 'unregistered'], enabled: !!ym, queryFn: () => fetchUnregistered(ym!) });
}

export type AdminRequestView = RequestView & { user_status: string };

export const adminRequestKey = (id: string) => ['admin-request', id] as const;

// Ngăn giữ đúng bản đang sửa: không tự tải lại khi quay lại tab (bản mới chỉ đến qua STALE hoặc review)
export function useAdminRequest(id: string, enabled = true) {
  return useQuery({
    queryKey: adminRequestKey(id),
    enabled,
    queryFn: () => apiFetch<AdminRequestView>(`/api/admin/requests/${id}`),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export const ADJUST_REASONS = ['over_quota', 'adm_out_of_stock', 'duplicate', 'user_left', 'other'] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

// Sau khóa sổ chỉ giảm/bỏ: mọi dòng hiện có, kèm số đang thấy; dòng giảm mang lý do riêng
export interface AdjustLineBody {
  id: string;
  qty: number;
  expected_qty: number;
  reason_code?: AdjustReason;
  reason_note?: string;
}

export interface AdjustBody {
  lines: AdjustLineBody[];
  expected_updated_at: string;
}

export const saveAdjust = (id: string, body: AdjustBody, csrfToken: string | null) =>
  apiFetch<{ request: RequestView }>(`/api/admin/requests/${id}/lines`, {
    method: 'PUT',
    body: JSON.stringify(body),
    csrfToken,
  });

// Kỳ đang mở chỉ xem: danh sách người đã đăng ký và phiếu từng người, không ghi gì
export function useRegistrations(ym: string | undefined) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, ym, 'registrations'],
    enabled: !!ym,
    queryFn: () => apiFetch<{ items: RegistrationRow[] }>(`${base(ym!)}/registrations`),
  });
}

export type RegistrationView = RequestView & { team: string | null; user_status: string };

export function useRegistration(ym: string, id: string | undefined) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, ym, 'registration', id],
    enabled: !!id,
    queryFn: () => apiFetch<RegistrationView>(`${base(ym)}/registrations/${id}`),
  });
}
