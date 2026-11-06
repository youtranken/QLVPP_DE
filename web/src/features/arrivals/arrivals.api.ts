import { apiFetch } from '@/lib/api-client';

export interface PlanMakeupGroup {
  ym: string;
  rows: { key: string; adm_owed: number }[];
}

// Kế hoạch Hàng về theo bản có hàng mới nhất (chưa có bản → số gộp)
export interface ArrivalsPlan {
  snapshot: { id: string; kind: string; created_at: string } | null;
  rows: { key: string; ordered: number; received: number; remaining: number; adm_out: boolean; usable: boolean }[];
  custom: { key: string; ordered: number; received: number; remaining: number; adm_out: boolean }[];
  makeup: PlanMakeupGroup[];
}

export const arrivalsPlanQuery = (ym: string) => ({
  queryKey: ['arrivals-plan', ym] as const,
  queryFn: () => apiFetch<ArrivalsPlan>(`/api/admin/periods/${ym}/arrivals-plan`),
});

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
