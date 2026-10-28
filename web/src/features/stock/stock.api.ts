import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { AdminItem } from '@/features/catalog/catalog.api';

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

export interface DirectoryUser {
  sub: string;
  fullName: string | null;
  email: string | null;
  department: string | null;
  status: 'active' | 'locked';
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
const USERS_KEY = ['users'] as const;
const MOVEMENTS_PAGE = 20;
const PICKER_LIMIT = 8;
const DIRECTORY_PAGE = 200;

export const isLowStock = (i: Pick<AdminItem, 'stock_qty' | 'min_stock'>) => i.stock_qty <= i.min_stock;

export const userLabel = (u: Pick<DirectoryUser, 'sub' | 'fullName'>) => u.fullName || u.sub;

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

export function useUserSearch(search: string) {
  return useQuery({
    queryKey: [...USERS_KEY, 'search', search],
    queryFn: () =>
      apiFetch<Page<DirectoryUser>>(
        `/api/admin/users?${new URLSearchParams({ search, limit: String(PICKER_LIMIT) })}`,
      ),
  });
}

// Sổ cái chỉ có sub; danh bạ phòng nhỏ nên tải hết một lần để hiện tên người
export function useDirectoryNames() {
  return useQuery({
    queryKey: [...USERS_KEY, 'directory'],
    queryFn: async () => {
      const names = new Map<string, string>();
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ limit: String(DIRECTORY_PAGE) });
        if (cursor) params.set('cursor', cursor);
        const page: Page<DirectoryUser> = await apiFetch(`/api/admin/users?${params}`);
        for (const u of page.items) names.set(u.sub, userLabel(u));
        cursor = page.next_cursor;
      } while (cursor);
      return names;
    },
    staleTime: 5 * 60_000,
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
