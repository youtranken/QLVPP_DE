import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface DirectoryUser {
  sub: string;
  fullName: string | null;
  email: string | null;
  department: string | null;
  status: 'active' | 'locked';
}

interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

const USERS_KEY = ['users'] as const;
const PICKER_LIMIT = 8;
const DIRECTORY_PAGE = 200;

export const userLabel = (u: Pick<DirectoryUser, 'sub' | 'fullName'>) => u.fullName || u.sub;

export function useUserSearch(search: string) {
  return useQuery({
    queryKey: [...USERS_KEY, 'search', search],
    queryFn: () =>
      apiFetch<Page<DirectoryUser>>(
        `/api/admin/users?${new URLSearchParams({ search, limit: String(PICKER_LIMIT) })}`,
      ),
  });
}

// Sổ cái chỉ có sub; danh bạ phòng nhỏ nên tải hết một lần để hiện tên người
export function useDirectoryNames() {
  return useQuery({
    queryKey: [...USERS_KEY, 'directory'],
    queryFn: async () => {
      const names = new Map<string, string>();
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ limit: String(DIRECTORY_PAGE) });
        if (cursor) params.set('cursor', cursor);
        const page: Page<DirectoryUser> = await apiFetch(`/api/admin/users?${params}`);
        for (const u of page.items) names.set(u.sub, userLabel(u));
        cursor = page.next_cursor;
      } while (cursor);
      return names;
    },
    staleTime: 5 * 60_000,
  });
}
