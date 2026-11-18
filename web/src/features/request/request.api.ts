import { keepPreviousData, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api-client';
import { apiErrorCode } from '@/lib/api-error';
import type { Category } from '@/features/catalog/catalog.api';
import { NOTIFICATIONS_KEY } from '@/features/notifications/notifications.api';

export interface CurrentPeriod {
  ym: string;
  deadline: string;
  is_open: boolean;
  days_left: number;
  previous: { ym: string; delivering: boolean } | null;
  // Phần còn chờ nhận của mọi kỳ đã khóa (chỉ nhân viên), cũ trước
  owed: OwedPeriod[];
}

export interface OwedPeriod {
  ym: string;
  items: number;
  units: number;
  lines: { name: string; name_en: string | null; unit: string; qty: number }[];
}

export type AdjustReason = 'over_quota' | 'adm_out_of_stock' | 'duplicate' | 'other' | 'user_left' | 'removed';

export interface LineAdjustment {
  before: number;
  after: number;
  reason_code: AdjustReason;
  reason_note: string | null;
  at: string;
}

export interface RemovedLine extends Omit<LineAdjustment, 'after'> {
  name: string;
  name_en: string | null;
  unit: string;
}

export type ReviewStatus = 'n/a' | 'pending' | 'accepted' | 'converted' | 'rejected';

export interface LineItemFacts {
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  image_file_id: string | null;
  active: boolean;
}

export interface LineView {
  id: string;
  item_id: string | null;
  item: LineItemFacts | null;
  custom_name: string | null;
  custom_unit: string | null;
  custom_note: string | null;
  image_file_id: string | null;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  cancel_note: string | null;
  review_status: ReviewStatus;
  review_note: string | null;
  added_by_admin: boolean;
  readonly_for_member: boolean;
  // Tối đa/tháng hiện tại của món (null với dòng ngoài DM); dòng giữ số cũ lớn hơn → "Vượt tối đa"
  max_qty: number | null;
  // ISO lần giao gần nhất; null khi chưa giao
  last_delivered_at: string | null;
  // Chỉ GET phiếu của chính mình ở kỳ đã khóa mới có; kỳ mở luôn rỗng
  adjustments?: LineAdjustment[];
}

export interface RequestView {
  id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  updated_at: string;
  // Giờ nhân viên lưu phiếu lần cuối ("lưu lúc"); updated_at còn đổi theo giao hàng/điều chỉnh
  saved_at: string;
  is_open: boolean;
  lines: LineView[];
  removed_lines?: RemovedLine[];
  removed_all?: boolean;
}

export interface MemberItem {
  id: string;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  category_id: string | null;
  image_file_id: string | null;
  max_qty: number;
  active: boolean;
  usable: boolean;
}

export interface LineInputBody {
  id?: string;
  item_id?: string;
  custom_name?: string | null;
  custom_unit?: string | null;
  custom_note?: string | null;
  image_file_id?: string | null;
  qty: number;
}

export interface SaveLinesBody {
  ym: string;
  lines: LineInputBody[];
  expected_updated_at?: string;
}

const REQUEST_KEY = ['request'] as const;
export const HISTORY_KEY = [...REQUEST_KEY, 'history'] as const;
export const ownRequestKey = (ym: string) => [...REQUEST_KEY, 'mine', ym] as const;

export const CURRENT_PERIOD_KEY = ['periods', 'current'] as const;

export const currentPeriodQuery = () =>
  queryOptions({
    queryKey: CURRENT_PERIOD_KEY,
    queryFn: () => apiFetch<CurrentPeriod>('/api/periods/current'),
  });

export function useCurrentPeriod() {
  return useQuery(currentPeriodQuery());
}

// Chưa có phiếu là trạng thái bình thường (phiếu chỉ tồn tại khi có dòng) → null, không phải lỗi
export function useMyRequest(ym: string | undefined) {
  return useQuery({
    queryKey: ownRequestKey(ym ?? ''),
    enabled: !!ym,
    queryFn: async () => {
      try {
        return await apiFetch<RequestView>(`/api/me/request?ym=${ym}`);
      } catch (e) {
        if ((e instanceof ApiError && e.status === 404) || apiErrorCode(e) === 'INVALID_PERIOD') return null;
        throw e;
      }
    },
  });
}

// Món đã ngừng vẫn cần tên và giới hạn khi đang nằm trên phiếu
export function useMemberItems(lineItemIds: string[] | undefined) {
  const ids = [...new Set(lineItemIds ?? [])].sort();
  return useQuery({
    queryKey: [...REQUEST_KEY, 'items', ids.join(',')],
    enabled: lineItemIds !== undefined,
    // Lưu xong đổi danh sách id → giữ món cũ trong lúc tải để trang không nháy về "đang tải"
    placeholderData: keepPreviousData,
    queryFn: () =>
      apiFetch<MemberItem[]>(ids.length ? `/api/items?include_inactive_ids=${ids.join(',')}` : '/api/items'),
  });
}

export function useMemberCategories() {
  return useQuery({
    queryKey: [...REQUEST_KEY, 'categories'],
    queryFn: () => apiFetch<Category[]>('/api/item-categories'),
  });
}

export function useSetMyRequest() {
  const qc = useQueryClient();
  return (ym: string, view: RequestView | null) => {
    qc.setQueryData(ownRequestKey(ym), view);
    // Danh sách lịch sử có kỳ này (tổng dòng/đơn vị) → phải tải lại
    void qc.invalidateQueries({ queryKey: HISTORY_KEY });
    // Server vừa đánh dấu đọc chuông nhắc của kỳ này
    void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  };
}

export const saveMyLines = (body: SaveLinesBody, csrfToken: string | null) =>
  apiFetch<{ request: RequestView | null }>('/api/me/request/lines', {
    method: 'PUT',
    body: JSON.stringify(body),
    csrfToken,
  });

export type SkipReason = 'INACTIVE' | 'ADDED_BY_ADMIN' | 'REJECTED' | 'UNIT_INACTIVE';

export type CopiedLine =
  | { item_id: string; qty: number }
  | {
      custom_name: string | null;
      custom_unit: string | null;
      custom_note: string | null;
      image_file_id: string | null;
      qty: number;
    };

export interface CopyPreviousResult {
  from_ym: string;
  lines: CopiedLine[];
  skipped: { name: string; reason: SkipReason }[];
  capped: { name: string; from: number; to: number }[];
  previously_accepted: string[];
}

// POST nhưng chỉ đọc (giỏ đề xuất); chưa có phiếu kỳ trước (404) → null = ẩn nút chép
export function useCopyPreviousQuery(ym: string, csrfToken: string | null) {
  return useQuery({
    queryKey: [...REQUEST_KEY, 'copy', ym],
    queryFn: async () => {
      try {
        return await apiFetch<CopyPreviousResult>('/api/me/request/copy-previous', { method: 'POST', csrfToken });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    // POST có thể tạo dòng periods: gọi một lần mỗi kỳ, không tự gọi lại khi mount/focus
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
