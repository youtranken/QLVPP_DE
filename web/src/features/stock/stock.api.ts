import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { AdminItem, StockState } from '@/features/catalog/catalog.api';

export type MovementReason = 'purchase' | 'adjust' | 'issue' | 'delivery' | 'return';

export interface StockMovement {
  id: string;
  delta: number;
  reason: MovementReason;
  note: string | null;
  actor_sub: string;
  recipient_sub: string | null;
  created_at: string;
}

interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface StockChangeBody {
  delta: number;
  reason: 'purchase' | 'adjust';
  note: string | null;
}

export interface IssueBody {
  qty: number;
  recipient_sub?: string;
  reason: string;
}

const STOCK_KEY = ['stock'] as const;
const MOVEMENTS_PAGE = 20;

// Server tính theo FR-50 (cùng điều kiện với GET admin/stock/low) để nhãn và bộ lọc không lệch nhau
export const stockState = (i: Pick<AdminItem, 'stock_state'>): StockState => i.stock_state;

export function useLowStock() {
  return useQuery({
    queryKey: [...STOCK_KEY, 'low'],
    queryFn: () => apiFetch<AdminItem[]>('/api/admin/stock/low'),
  });
}

export function useMovements(itemId: string) {
  return useInfiniteQuery({
    queryKey: [...STOCK_KEY, 'movements', itemId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(MOVEMENTS_PAGE) });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<Page<StockMovement>>(`/api/admin/items/${itemId}/movements?${params}`);
    },
    getNextPageParam: (last) => last.next_cursor,
  });
}

// Tồn hiện ở cả trang Kho và Danh mục nên làm mới cả hai
export function useRefreshStock() {
  const qc = useQueryClient();
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: STOCK_KEY }), qc.invalidateQueries({ queryKey: ['catalog'] })]);
}

export const changeStock = (itemId: string, body: StockChangeBody, csrfToken: string | null) =>
  apiFetch<{ stock_qty: number }>(`/api/admin/items/${itemId}/stock`, {
    method: 'POST',
    body: JSON.stringify(body),
    csrfToken,
  });

export const issueStock = (itemId: string, body: IssueBody, csrfToken: string | null) =>
  apiFetch<{ stock_qty: number }>(`/api/admin/items/${itemId}/issue`, {
    method: 'POST',
    body: JSON.stringify(body),
    csrfToken,
  });
