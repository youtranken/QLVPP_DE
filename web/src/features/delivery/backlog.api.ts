import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { BACKLOG_KEY } from './delivery.api';

export const BACKLOG_BY = ['item', 'person'] as const;
export type BacklogBy = (typeof BACKLOG_BY)[number];

export interface BacklogLine {
  line_id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  user_status: string;
  item_id: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  remaining_qty: number;
  stock_qty: number | null;
}

export interface BacklogGroup {
  key: string;
  label: {
    item_id?: string | null;
    name?: string;
    unit?: string;
    user_sub?: string;
    full_name?: string | null;
    department?: string | null;
  };
  remaining_qty: number;
  lines: BacklogLine[];
}

export interface LineDelivery {
  id: string;
  qty: number;
  movement_id: string | null;
  actor_sub: string;
  actor_name: string | null;
  created_at: string;
}

export interface LineDeliveries {
  line: { id: string; qty: number; delivered_qty: number; cancelled_qty: number; cancel_note: string | null };
  items: LineDelivery[];
}

export interface CancelBody {
  reason: string;
  expected_delivered_qty: number;
  expected_qty: number;
}

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export const parseBy = (v: string | null): BacklogBy => (v === 'person' ? 'person' : 'item');

export function useBacklog(by: BacklogBy) {
  return useQuery({
    queryKey: [...BACKLOG_KEY, by],
    queryFn: () => apiFetch<{ groups: BacklogGroup[] }>(`/api/admin/backlog?by=${by}`),
  });
}

export function useLineDeliveries(lineId: string) {
  return useQuery({
    queryKey: [...BACKLOG_KEY, 'deliveries', lineId],
    queryFn: () => apiFetch<LineDeliveries>(`/api/admin/lines/${lineId}/deliveries`),
  });
}

export const cancelRemaining = (lineId: string, body: CancelBody, csrfToken: string | null) =>
  apiFetch<unknown>(`/api/admin/lines/${lineId}/cancel-remaining`, { method: 'POST', body: JSON.stringify(body), csrfToken });
