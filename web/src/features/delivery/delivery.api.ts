import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { LineView } from '@/features/request/request.api';
import { useRefreshStock } from '@/features/stock/stock.api';
import { SUMMARY_KEY, adminRequestKey } from '@/features/summary/summary.api';

export interface DeliverBody {
  qty: number;
  expected_delivered_qty: number;
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

export const deliverLine = (lineId: string, body: DeliverBody, csrfToken: string | null) =>
  apiFetch<unknown>(`/api/admin/lines/${lineId}/deliver`, { method: 'POST', body: JSON.stringify(body), csrfToken });

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
