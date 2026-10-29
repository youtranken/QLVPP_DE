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
async function send(path: string, init: RequestInit & { csrfToken?: string | null } = {}): Promise<Response> {
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
  return res;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { csrfToken?: string | null } = {},
): Promise<T> {
  const res = await send(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const FLAT_NAME = /^[^/\\]+$/;

function fileNameOf(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plain = /filename="([^"]+)"/i.exec(disposition) ?? /filename=([^;]+)/i.exec(disposition);
  let name: string | undefined;
  try {
    name = star ? decodeURIComponent(star[1].trim()) : plain?.[1].trim();
  } catch {
    name = undefined;
  }
  // Tên từ server chỉ dùng khi là tên phẳng: không thư mục, không ".."
  return name && FLAT_NAME.test(name) && !name.includes('..') ? name : null;
}

// Tệp tải về đi qua fetch (không phải <a href>) để 401/lỗi được xử lý như mọi request khác
export async function apiFetchBlob(path: string): Promise<{ blob: Blob; fileName: string | null }> {
  const res = await send(path);
  return { blob: await res.blob(), fileName: fileNameOf(res.headers.get('Content-Disposition')) };
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
