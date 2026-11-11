import { apiFetch } from '@/lib/api-client';

export interface PlanRow {
  item_id: string;
  key: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  category_id: string | null;
  image_file_id: string | null;
  ordered: number;
  received: number;
  remaining: number;
  stock_qty: number;
  usable: boolean;
  inactive_reason: 'item' | 'category' | null;
  adm_out: boolean;
  adm_out_final: boolean;
  reduced_after_snapshot: number;
}

export interface PlanCustomRow {
  key: string;
  name: string;
  unit: string;
  ordered: number;
  received: number;
  remaining: number;
  adm_out: boolean;
  adm_out_final: boolean;
}

export interface PlanMakeupRow {
  key: string;
  item_id: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  stock_qty: number | null;
  ordered: number;
  received: number;
  adm_owed: number;
}

export interface PlanMakeupGroup {
  ym: string;
  rows: PlanMakeupRow[];
}

export interface PlanBatch {
  at: string;
  actor_name: string | null;
  items: number;
  units: number;
  note: string | null;
}

// Kế hoạch Hàng về theo bản có hàng mới nhất; chưa gửi NCC thì rows/custom rỗng, chỉ còn về bù kỳ trước
export interface ArrivalsPlan {
  snapshot: { id: string; kind: string; created_at: string } | null;
  no_order: { at: string; by_name: string | null } | null;
  batches: PlanBatch[];
  rows: PlanRow[];
  custom: PlanCustomRow[];
  makeup: PlanMakeupGroup[];
}

export const ARRIVALS_PLAN_KEY = ['arrivals-plan'] as const;
export const arrivalsPlanKey = (ym: string) => [...ARRIVALS_PLAN_KEY, ym] as const;

export const arrivalsPlanQuery = (ym: string) => ({
  queryKey: arrivalsPlanKey(ym),
  queryFn: () => apiFetch<ArrivalsPlan>(`/api/admin/periods/${ym}/arrivals-plan`),
});

export interface ReceiptLineBody {
  item_id: string;
  qty: number;
  expected_stock_qty: number;
}

// snapshot_id = bản in đang xem (null = chưa có bản): server trả STALE_UPDATE nếu đã có bản mới hơn; về bù không gửi
export interface ReceiptBody {
  lines: ReceiptLineBody[];
  ym: string;
  note?: string;
  snapshot_id?: string | null;
}

export interface ReceiptResult {
  items: { item_id: string; stock_qty: number; movement_id: string }[];
}

export const postReceipt = (body: ReceiptBody, csrf: string | null) =>
  apiFetch<ReceiptResult>('/api/admin/stock/receipts', { method: 'POST', body: JSON.stringify(body), csrfToken: csrf });

// line_key = item_id hoặc khóa ngoài danh mục custom:["tên", "đơn vị"] (ngoặc, dấu, khoảng trắng) nên phải mã hóa
const keyPath = (ym: string, kind: 'adm-out' | 'adm-owed-closed', key: string) =>
  `/api/admin/periods/${ym}/${kind}/${encodeURIComponent(key)}`;

export const setAdmOut = (ym: string, key: string, on: boolean, csrf: string | null) =>
  apiFetch<unknown>(keyPath(ym, 'adm-out', key), { method: on ? 'PUT' : 'DELETE', csrfToken: csrf });

export const setOwedClosed = (ym: string, key: string, on: boolean, csrf: string | null) =>
  apiFetch<unknown>(keyPath(ym, 'adm-owed-closed', key), { method: on ? 'PUT' : 'DELETE', csrfToken: csrf });

export interface CustomReceiptBody {
  line_key: string;
  qty: number;
  expected_received: number;
  snapshot_id?: string | null;
}

export const postCustomReceipt = (ym: string, body: CustomReceiptBody, csrf: string | null) =>
  apiFetch<{ received: number }>(`/api/admin/periods/${ym}/custom-receipts`, { method: 'POST', body: JSON.stringify(body), csrfToken: csrf });
