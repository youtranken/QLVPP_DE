import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { HISTORY_KEY } from './request.api';

export interface HistoryItem {
  period_ym: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  remaining_qty: number;
  cancelled_qty: number;
  custom: { pending: number; accepted: number; converted: number; rejected: number };
}

interface HistoryPage {
  items: HistoryItem[];
  next_cursor: string | null;
}

const PAGE = 12;

export function useMyHistory() {
  return useInfiniteQuery({
    queryKey: HISTORY_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<HistoryPage>(`/api/me/requests?limit=${PAGE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export interface MyIssue {
  id: string;
  item_id: string;
  item_name: string;
  item_name_en: string | null;
  unit: string;
  qty: number;
  note: string;
  created_at: string;
}

export const ISSUES_KEY = ['request', 'my-issues'] as const;
export const ISSUE_PAGE = 10;

export function useMyIssues() {
  return useInfiniteQuery({
    queryKey: ISSUES_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<{ items: MyIssue[]; next_cursor: string | null }>(
        `/api/me/issues?limit=${ISSUE_PAGE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export type DeliveryState = 'none' | 'cancelled' | 'done' | 'owed' | 'undelivered';

// Chỉ hủy hết (không giao gì) là "Đã hủy", không phải "Đã giao đủ"; kỳ chỉ có món chờ/từ chối (total 0) không có trạng thái giao
export function deliveryState(h: Pick<HistoryItem, 'total_qty' | 'delivered_qty' | 'remaining_qty'>): DeliveryState {
  if (h.total_qty === 0) return 'none';
  if (h.remaining_qty === 0) return h.delivered_qty === 0 ? 'cancelled' : 'done';
  return h.delivered_qty > 0 ? 'owed' : 'undelivered';
}
