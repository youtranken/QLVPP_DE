import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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

// Tên hiển thị cho một sub trong sổ kho/nhật ký. Chỉ gọi "Người dùng cũ" khi đã tải hết danh bạ mà không thấy;
// đang tải thì để dấu chờ; danh bạ quá lớn (không tải hết) thì hiện sub vì không chắc người đó đã rời
export function usePersonName() {
  const { t } = useTranslation();
  const all = useQuery(allUsersQuery);
  const names = all.data && !all.data.overflow ? new Map(all.data.items.map((u) => [u.sub, userLabel(u)])) : null;
  return (sub: string): string => {
    if (sub.startsWith('system')) return t('directory.person.system');
    if (names) return names.get(sub) ?? t('directory.person.former');
    return all.data?.overflow || all.isError ? sub : t('directory.person.loading');
  };
}

// Người đã xoá ẩn khỏi danh bạ mặc định: chỉ tải khi bộ lọc "Đã xoá" đang bật
export function useDeletedUsers(enabled: boolean) {
  const q = useQuery({
    queryKey: ['users', 'admin-deleted'],
    queryFn: () => loadAllUsers((c) => fetchUsersPage('', c, 'deleted')),
    enabled,
    staleTime: 60_000,
  });
  return { users: q.data?.items ?? [], loading: enabled && q.isPending, failed: q.isError, retry: () => void q.refetch() };
}

// enabled=false: chưa tải gì (ô chọn người chưa mở danh sách thì không kéo cả danh bạ về)
export function useDirectoryUsers(search: string, enabled = true) {
  const all = useQuery({ ...allUsersQuery, enabled });
  const overflow = all.data?.overflow ?? false;
  const server = useInfiniteQuery({
    queryKey: ['users', 'admin-search', search],
    enabled: enabled && overflow,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchUsersPage(search, pageParam),
    getNextPageParam: (last) => last.next_cursor,
  });
  const active = overflow ? server : all;
  return {
    overflow,
    users: overflow ? (server.data?.pages.flatMap((p) => p.items) ?? []) : (all.data?.items ?? []),
    loading: enabled && (all.isPending || (overflow && server.isPending)),
    failed: active.isError,
    retry: () => void (overflow ? server.refetch() : all.refetch()),
    hasMore: overflow && Boolean(server.hasNextPage),
    fetchMore: () => void server.fetchNextPage(),
    fetchingMore: server.isFetchingNextPage,
  };
}
