import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchUsersPage, userLabel, type AdminUser } from './directory.api';

export const DIRECTORY_FULL_LOAD_MAX = 2000;

export const exceedsFullLoad = (count: number) => count > DIRECTORY_FULL_LOAD_MAX;

type FetchPage = (cursor: string | null) => Promise<{ items: AdminUser[]; next_cursor: string | null }>;

export interface LoadedUsers {
  items: AdminUser[];
  overflow: boolean;
}

// Dừng ngay khi vượt ngưỡng: danh bạ lớn hơn thì chuyển sang tìm ở server thay vì tải hết
export async function loadAllUsers(fetchPage: FetchPage): Promise<LoadedUsers> {
  const items: AdminUser[] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    if (exceedsFullLoad(items.length)) return { items: [], overflow: true };
    cursor = page.next_cursor;
  } while (cursor);
  return { items, overflow: false };
}

const allUsersQuery = {
  queryKey: ['users', 'admin-all'],
  queryFn: () => loadAllUsers((c) => fetchUsersPage('', c)),
  staleTime: 60_000,
};

// Sổ cái/Nhật ký chỉ có sub: dùng chung bộ tải hết danh bạ; vượt ngưỡng thì Map rỗng, nơi dùng hiện sub
export function useDirectoryNames() {
  return useQuery({ ...allUsersQuery, select: (all: LoadedUsers) => new Map(all.items.map((u) => [u.sub, userLabel(u)])) });
}

export function useDirectoryUsers(search: string) {
  const all = useQuery(allUsersQuery);
  const overflow = all.data?.overflow ?? false;
  const server = useInfiniteQuery({
    queryKey: ['users', 'admin-search', search],
    enabled: overflow,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchUsersPage(search, pageParam),
    getNextPageParam: (last) => last.next_cursor,
  });
  const active = overflow ? server : all;
  return {
    overflow,
    users: overflow ? (server.data?.pages.flatMap((p) => p.items) ?? []) : (all.data?.items ?? []),
    loading: all.isPending || (overflow && server.isPending),
    failed: active.isError,
    retry: () => void (overflow ? server.refetch() : all.refetch()),
    hasMore: overflow && Boolean(server.hasNextPage),
    fetchMore: () => void server.fetchNextPage(),
    fetchingMore: server.isFetchingNextPage,
  };
}
