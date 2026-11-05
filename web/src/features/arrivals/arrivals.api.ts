import { apiFetch } from '@/lib/api-client';

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
