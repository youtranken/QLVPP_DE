import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api-client';
import type { Category } from '@/features/catalog/catalog.api';

export interface CurrentPeriod {
  ym: string;
  deadline: string;
  is_open: boolean;
  days_left: number;
  previous: { ym: string; delivering: boolean } | null;
}

export type ReviewStatus = 'n/a' | 'pending' | 'accepted' | 'converted' | 'rejected';

export interface LineItemFacts {
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  image_file_id: string | null;
  active: boolean;
  admin_only: boolean;
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
  review_status: ReviewStatus;
  review_note: string | null;
  added_by_admin: boolean;
  readonly_for_member: boolean;
}

export interface RequestView {
  id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  updated_at: string;
  is_open: boolean;
  lines: LineView[];
}

export interface MemberItem {
  id: string;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  category_id: string | null;
  image_file_id: string | null;
  admin_only: boolean;
  max_qty: number;
  active: boolean;
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
export const myRequestKey = (ym: string) => [...REQUEST_KEY, 'mine', ym] as const;

export function useCurrentPeriod() {
  return useQuery({
    queryKey: [...REQUEST_KEY, 'period'],
    queryFn: () => apiFetch<CurrentPeriod>('/api/periods/current'),
  });
}

// Chưa có phiếu là trạng thái bình thường (phiếu chỉ tồn tại khi có dòng) → null, không phải lỗi
export function useMyRequest(ym: string | undefined) {
  return useQuery({
    queryKey: myRequestKey(ym ?? ''),
    enabled: !!ym,
    queryFn: async () => {
      try {
        return await apiFetch<RequestView>(`/api/me/request?ym=${ym}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });
}

// Món đã ngừng/chỉ Hành chính vẫn cần tên và giới hạn khi đang nằm trên phiếu
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
  return (ym: string, view: RequestView | null) => qc.setQueryData(myRequestKey(ym), view);
}

export const saveMyLines = (body: SaveLinesBody, csrfToken: string | null) =>
  apiFetch<{ request: RequestView | null }>('/api/me/request/lines', {
    method: 'PUT',
    body: JSON.stringify(body),
    csrfToken,
  });
