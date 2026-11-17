import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { STOCK_KEY, type MovementReason } from './stock.api';

export const LEDGER_KINDS = ['purchase', 'delivery', 'issue', 'return'] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export interface LedgerRow {
  id: string;
  item_id: string;
  item_name: string;
  item_name_en: string | null;
  unit: string;
  delta: number;
  reason: MovementReason;
  note: string | null;
  actor_name: string | null;
  recipient_name: string | null;
  receipt_ym: string | null;
  created_at: string;
}

interface LedgerPage {
  items: LedgerRow[];
  next_cursor: string | null;
  totals: { in: number; out: number };
}

// Sổ cái toàn kho một tháng (G5); thêm trang bằng cursor, tổng Nhập/Ra của cả tháng đã lọc nằm ở mọi trang
export function useStockLedger(ym: string, kind: LedgerKind | null) {
  return useInfiniteQuery({
    queryKey: [...STOCK_KEY, 'ledger', ym, kind],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ ym });
      if (kind) params.set('kind', kind);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<LedgerPage>(`/api/admin/stock/movements?${params}`);
    },
    getNextPageParam: (last) => last.next_cursor,
  });
}
