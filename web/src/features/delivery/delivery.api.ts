import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { LineView } from '@/features/request/request.api';
import { useRefreshStock } from '@/features/stock/stock.api';
import { SUMMARY_KEY, adminRequestKey } from '@/features/summary/summary.api';

export interface DeliverBody {
  qty: number;
  expected_delivered_qty: number;
}

export interface DeliverResult {
  request_complete?: boolean;
}

export interface DeliverAllFailure {
  line_id: string;
  code: string;
  available?: number;
}

export interface DeliverAllResult {
  delivered: { line_id: string; qty: number }[];
  failed: DeliverAllFailure[];
}

export const BACKLOG_KEY = ['backlog'] as const;

// Cùng luật EFFECTIVE_LINE/REMAINING_QTY của api: chờ xem/từ chối không giao
export const isDeliverable = (l: LineView) => ['n/a', 'accepted', 'converted'].includes(l.review_status);
export const remainingOf = (l: LineView) => l.qty - l.delivered_qty - l.cancelled_qty;
export interface UnitTotals {
  total_qty: number;
  delivered_qty: number;
  cancelled_qty: number;
}

// Phần đã hủy coi như xong, như tiến độ ở Tổng hợp
export const unitProgress = (t: UnitTotals) => ({ done: t.delivered_qty + t.cancelled_qty, total: t.total_qty });

export const unitTotalsOf = (lines: LineView[]): UnitTotals =>
  lines.filter(isDeliverable).reduce(
    (s, l) => ({ total_qty: s.total_qty + l.qty, delivered_qty: s.delivered_qty + l.delivered_qty, cancelled_qty: s.cancelled_qty + l.cancelled_qty }),
    { total_qty: 0, delivered_qty: 0, cancelled_qty: 0 },
  );
export const isComplete = (lines: LineView[]) => lines.filter(isDeliverable).every((l) => remainingOf(l) <= 0);

// Chỉ để kẹp nút: server STOCK_INSUFFICIENT/DELIVER_EXCEEDS_QTY mới là chuẩn; món ngoài DM không có tồn
export function deliverMax(remaining: number, stock: number | null, cap?: number): number {
  return Math.max(0, Math.min(remaining, stock ?? remaining, cap ?? remaining));
}

export const deliverLine = (lineId: string, body: DeliverBody, csrfToken: string | null) =>
  apiFetch<DeliverResult>(`/api/admin/lines/${lineId}/deliver`, { method: 'POST', body: JSON.stringify(body), csrfToken });

export const deliverAll = (requestId: string, csrfToken: string | null) =>
  apiFetch<DeliverAllResult>(`/api/admin/requests/${requestId}/deliver-all`, { method: 'POST', csrfToken });

// Một đợt giao đổi phiếu, Tổng hợp/KPI, Còn nợ và tồn kho cùng lúc
export function useRefreshAfterDelivery() {
  const qc = useQueryClient();
  const refreshStock = useRefreshStock();
  return (requestId: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: adminRequestKey(requestId) }),
      qc.invalidateQueries({ queryKey: SUMMARY_KEY }),
      qc.invalidateQueries({ queryKey: BACKLOG_KEY }),
      refreshStock(),
    ]);
}
