import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export type SummaryFilter = 'all' | 'pending_delivery' | 'custom_pending';

export interface PeriodSummary {
  ym: string;
  deadline: string | null;
  is_open: boolean;
  registered: number;
  headcount: number;
  headcount_source: 'snapshot' | 'live';
  unregistered: number;
  lines_pending_delivery: number;
  custom_pending: number;
  low_stock: number;
}

export interface PersonRow {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  user_status: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  custom_pending: number;
  updated_at: string;
}

export interface ItemSummaryRow {
  key: string;
  item_id: string | null;
  name: string;
  unit: string;
  requested_qty: number;
  people: number;
}

export interface UnregisteredUser {
  sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

const SUMMARY_KEY = ['admin-summary'] as const;
const PERSON_PAGE = 100;
const base = (ym: string) => `/api/admin/periods/${ym}`;

export function usePeriodSummary(ym: string | undefined) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, ym, 'kpi'],
    enabled: !!ym,
    queryFn: () => apiFetch<PeriodSummary>(`${base(ym!)}/summary`),
  });
}

export function usePersonRows(ym: string | undefined, filter: SummaryFilter, q: string) {
  return useInfiniteQuery({
    queryKey: [...SUMMARY_KEY, ym, 'person', filter, q],
    enabled: !!ym,
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ by: 'person', filter, limit: String(PERSON_PAGE) });
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<{ items: PersonRow[]; next_cursor: string | null }>(`${base(ym!)}/requests?${params}`);
    },
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function useItemRows(ym: string | undefined) {
  return useQuery({
    queryKey: [...SUMMARY_KEY, ym, 'item'],
    enabled: !!ym,
    queryFn: () => apiFetch<{ items: ItemSummaryRow[] }>(`${base(ym!)}/requests?by=item`),
  });
}

export const fetchUnregistered = (ym: string) =>
  apiFetch<{ items: UnregisteredUser[] }>(`${base(ym)}/unregistered`);
