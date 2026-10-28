import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { LineView, ReviewStatus } from '@/features/request/request.api';
import { useRefreshCatalog } from '@/features/catalog/catalog.api';
import { SUMMARY_KEY } from '@/features/summary/summary.api';

export const REVIEW_FILTERS = ['pending', 'accepted', 'converted', 'rejected'] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export interface ReviewRow {
  line_id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  custom_name: string | null;
  custom_unit: string | null;
  custom_note: string | null;
  image_file_id: string | null;
  qty: number;
  review_status: ReviewStatus;
  review_note: string | null;
  previously_accepted: boolean;
  item_id: string | null;
  created_at: string;
}

// Hình tối thiểu để ReviewActions dùng được cho cả thẻ trang review lẫn LineView trong ngăn điều chỉnh
export type ReviewableLine = Pick<
  LineView,
  'id' | 'custom_name' | 'custom_unit' | 'image_file_id' | 'qty' | 'review_status' | 'review_note'
>;

export interface NewItemInput {
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  category_id: string;
  image_file_id?: string;
  max_qty: number;
  admin_only: boolean;
}

export type ReviewBody =
  | { action: 'accept'; note?: string }
  | { action: 'reject'; note: string }
  | { action: 'convert'; note?: string; item: { existing_id: string } | NewItemInput };

export interface ReviewedItem {
  id: string;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  image_file_id: string | null;
  active: boolean;
  admin_only: boolean;
  max_qty: number;
}

export interface ReviewResult {
  line: LineView;
  // Review đổi phiên bản phiếu: ngăn điều chỉnh phải cập nhật expected_updated_at theo giá trị này
  request_updated_at: string;
  item?: ReviewedItem;
  unit_mismatch?: boolean;
}

export const REVIEW_KEY = ['admin-review'] as const;

export function useReviewLines(status: ReviewFilter, ym: string) {
  return useQuery({
    queryKey: [...REVIEW_KEY, status, ym],
    queryFn: () => {
      const params = new URLSearchParams({ status });
      if (ym) params.set('ym', ym);
      return apiFetch<{ items: ReviewRow[] }>(`/api/admin/review?${params}`);
    },
  });
}

export const reviewLine = (lineId: string, body: ReviewBody, csrfToken: string | null) =>
  apiFetch<ReviewResult>(`/api/admin/lines/${lineId}/review`, { method: 'POST', body: JSON.stringify(body), csrfToken });

export function useReviewCache() {
  const qc = useQueryClient();
  const refreshCatalog = useRefreshCatalog();
  return {
    // Món mới vào danh mục và KPI "chờ xem" của Tổng hợp đổi theo
    reviewed: () =>
      Promise.all([refreshCatalog(), qc.invalidateQueries({ queryKey: SUMMARY_KEY })]),
    refetchList: () => qc.invalidateQueries({ queryKey: REVIEW_KEY }),
    // Thẻ vừa xử lý ở lại với nhãn trạng thái; danh sách tải lại ở lần xem sau
    markListStale: () => qc.invalidateQueries({ queryKey: REVIEW_KEY, refetchType: 'none' }),
  };
}
