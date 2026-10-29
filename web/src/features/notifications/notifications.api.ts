import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useMe } from '@/lib/me';

export interface NotificationView {
  id: string;
  topic: string;
  params: Record<string, unknown>;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

interface NotificationPage {
  items: NotificationView[];
  next_cursor: string | null;
  unread_count: number;
}

export const NOTIFICATIONS_KEY = ['notifications'] as const;
const PAGE = 20;
const POLL_MS = 60_000;

export function useUnreadCount(): number {
  const q = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread'],
    queryFn: () => apiFetch<NotificationPage>('/api/me/notifications?unread=true&limit=1'),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  return q.data?.unread_count ?? 0;
}

export function useNotifications(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list'],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<NotificationPage>(`/api/me/notifications?${params}`);
    },
    getNextPageParam: (last) => last.next_cursor,
  });
}

// Không có ids = đánh dấu tất cả (API từ chối ids rỗng)
export function markRead(ids: string[] | undefined, csrfToken: string | null): Promise<{ updated: number }> {
  return apiFetch('/api/me/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
    csrfToken,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  const { csrfToken } = useMe();
  return useMutation({
    mutationFn: (ids?: string[]) => markRead(ids, csrfToken),
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
