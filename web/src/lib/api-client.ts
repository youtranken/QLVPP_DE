import { QueryClient } from '@tanstack/react-query';
import { handleSessionExpired } from '@/lib/session-relogin';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// 401 xử lý tập trung (tự SSO lại một lần) thay vì mỗi màn tự redirect
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { csrfToken?: string | null } = {},
): Promise<T> {
  const { csrfToken, headers, body, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    body,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...headers,
    },
  });
  if (res.status === 401) {
    handleSessionExpired();
    throw new ApiError(401, null);
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const queryClient = makeQueryClient();
