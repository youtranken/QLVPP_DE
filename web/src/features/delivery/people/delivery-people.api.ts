import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export type DeliveryPersonStatus = 'pending' | 'debt' | 'done';

export interface DeliveryPersonLine {
  line_id: string;
  request_id: string;
  period_ym: string;
  is_debt: boolean;
  item_id: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  image_file_id: string | null;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  remaining_qty: number;
  stock_qty: number | null;
  review_status: 'n/a' | 'pending' | 'accepted' | 'converted';
}

export interface DeliveryPerson {
  user_sub: string;
  full_name: string | null;
  department: string | null;
  user_status: string;
  request_id: string | null;
  status: DeliveryPersonStatus;
  owed_lines: number;
  open_lines: number;
  // Chưa nhận = còn dòng tháng đang giao; Còn nợ = còn dòng tháng trước; một người có thể có cả hai
  has_pending: boolean;
  has_debt: boolean;
  deliverable_now: boolean;
  lines: DeliveryPersonLine[];
}

export const DELIVERY_PEOPLE_KEY = ['admin', 'delivery-people'] as const;

export const deliveryPeopleQuery = (ym: string | undefined) =>
  queryOptions({
    queryKey: [...DELIVERY_PEOPLE_KEY, ym],
    enabled: !!ym,
    queryFn: () => apiFetch<{ ym: string; people: DeliveryPerson[] }>(`/api/admin/periods/${ym}/delivery-people`),
  });

export function useDeliveryPeople(ym: string | undefined) {
  return useQuery(deliveryPeopleQuery(ym));
}
