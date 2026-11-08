import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface ItemPerson {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  team: string | null;
  qty: number;
  before: number | null;
  reason_code: string | null;
  reason_note: string | null;
}

export interface ItemPeople {
  key: string;
  name: string;
  unit: string;
  requested: number;
  after: number;
  people: ItemPerson[];
}

export function useItemPeople(ym: string, key: string | null) {
  return useQuery({
    queryKey: ['reports', ym, 'item-people', key],
    enabled: key !== null,
    queryFn: () => apiFetch<ItemPeople>(`/api/admin/periods/${ym}/items/${encodeURIComponent(key!)}/people`),
  });
}
