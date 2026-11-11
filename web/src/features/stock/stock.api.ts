import { queryOptions, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { REPORTS_KEY } from '@/features/reports/reports.api';

export type MovementReason = 'purchase' | 'adjust' | 'issue' | 'delivery' | 'return';

export interface StockMovement {
  id: string;
  delta: number;
  reason: MovementReason;
  note: string | null;
  actor_sub: string;
  recipient_sub: string | null;
  // Chủ phiếu của dòng giao (sổ kho không ghi người nhận cho dòng giao)
  delivered_to_sub?: string | null;
  // Kỳ của lần hàng về (YYYY-MM); null với nhập ngoài kỳ và các loại khác
  receipt_ym?: string | null;
  created_at: string;
}

interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface StockChangeBody {
  delta: number;
  reason: 'purchase';
  note: string | null;
}

export interface IssueBody {
  qty: number;
  recipient_sub?: string;
  reason: string;
}

export interface IssueRow {
  id: string;
  item_id: string;
  item_name: string;
  item_name_en: string | null;
  unit: string;
  qty: number;
  recipient_sub: string | null;
  recipient_name: string | null;
  note: string | null;
  actor_sub: string;
  created_at: string;
}

export type HeldStockState = 'short' | 'incoming' | 'none' | 'low' | 'untracked' | 'ok';

// Tủ/Kho theo người đang chờ: held = phần còn lại của dòng kỳ khóa, incoming = hàng ADM đang về
export interface StockFacts {
  item_id: string;
  stock_qty: number;
  restock_level: number | null;
  held: number;
  free: number;
  short: number;
  incoming: number;
  // Phần thiếu đã có hàng đang về bù ("Chờ hàng về n")
  awaiting: number;
  // Số người đang chờ món
  waiting: number;
  stock_state: HeldStockState;
}

const STOCK_KEY = ['stock'] as const;
export const ISSUES_KEY = ['admin', 'issues'] as const;
const MOVEMENTS_PAGE = 20;

export const lowStockQuery = () =>
  queryOptions({
    queryKey: [...STOCK_KEY, 'low'],
    queryFn: () => apiFetch<AdminItem[]>('/api/admin/stock/low'),
  });

export const stockListQuery = () =>
  queryOptions({
    queryKey: [...STOCK_KEY, 'list'],
    queryFn: () => apiFetch<StockFacts[]>('/api/admin/stock'),
  });

export const issuesQuery = (ym: string | undefined) =>
  queryOptions({
    queryKey: [...ISSUES_KEY, ym],
    enabled: !!ym,
    queryFn: () => apiFetch<IssueRow[]>(`/api/admin/issues?ym=${ym}`),
  });

export function useLowStock() {
  return useQuery(lowStockQuery());
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

// Tồn hiện ở cả trang Kho, Danh mục và báo cáo nên làm mới cả ba; danh sách xuất lẻ không đang mở chỉ bị đánh dấu cũ, không gọi mạng
export function useRefreshStock() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: STOCK_KEY }),
      qc.invalidateQueries({ queryKey: ['catalog'] }),
      qc.invalidateQueries({ queryKey: ISSUES_KEY }),
      // Tồn đổi thì "Cần mua" của báo cáo/Gửi ADM đổi theo
      qc.invalidateQueries({ queryKey: REPORTS_KEY }),
    ]);
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
