import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { REPORTS_KEY } from '@/features/reports/reports.api';
import { useRefreshStock } from '@/features/stock/stock.api';
import { SUMMARY_KEY } from '@/features/summary/summary.api';
import { BACKLOG_KEY } from '@/features/delivery/delivery.api';
import { DELIVERY_PEOPLE_KEY } from '@/features/delivery/people/delivery-people.api';

export interface ReceiptLineBody {
  item_id: string;
  qty: number;
  expected_stock_qty: number;
}

export interface ReceiptBody {
  lines: ReceiptLineBody[];
  ym: string;
  note?: string;
}

export interface ReceiptResult {
  items: { item_id: string; stock_qty: number; movement_id: string }[];
}

export const postReceipt = (body: ReceiptBody, csrf: string | null) =>
  apiFetch<ReceiptResult>('/api/admin/stock/receipts', { method: 'POST', body: JSON.stringify(body), csrfToken: csrf });

// Hàng về đổi Cần mua của báo cáo, tồn trên danh mục/kho, trần giao theo người, Tổng hợp/đếm sidebar và Còn nợ
export function useRefreshAfterReceipt() {
  const qc = useQueryClient();
  const refreshStock = useRefreshStock();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: REPORTS_KEY }),
      qc.invalidateQueries({ queryKey: DELIVERY_PEOPLE_KEY }),
      qc.invalidateQueries({ queryKey: SUMMARY_KEY }),
      qc.invalidateQueries({ queryKey: BACKLOG_KEY }),
      refreshStock(),
    ]);
}
