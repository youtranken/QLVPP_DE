import { ErrorCode } from '@vpp/shared';

/**
 * Client gọi API.
 * Xác thực bằng **cookie phiên httpOnly** (mẫu BFF) nên mọi request phải kèm
 * `credentials: 'include'`; frontend không bao giờ chạm vào token OIDC.
 */

/** Lỗi nghiệp vụ từ backend: `{ code, message, violations? , fields? }`. */
export interface ApiErrorBody {
  code?: ErrorCode | string;
  message?: string;
  violations?: { code: string; message: string; lineIndex?: number }[];
  fields?: { path: string; message: string }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message ?? `Lỗi ${status}`);
    this.name = 'ApiError';
  }

  get code(): string {
    return this.body.code ?? ErrorCode.INTERNAL;
  }

  /** Thông điệp hiển thị được: ưu tiên lỗi chi tiết của từng dòng/ô nhập. */
  get displayMessage(): string {
    return (
      this.body.violations?.[0]?.message ??
      this.body.fields?.[0]?.message ??
      this.body.message ??
      'Có lỗi xảy ra, vui lòng thử lại.'
    );
  }
}

async function parseBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers:
      init.body instanceof FormData
        ? init.headers
        : { 'Content-Type': 'application/json', ...init.headers },
  });

  if (!response.ok) throw new ApiError(response.status, await parseBody(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>(path, { method: 'POST', body: form });
  },
};

/**
 * Chuyển hướng sang PMH ID. Dùng `location.assign` vì đây là điều hướng RỜI app.
 *
 * `returnTo` chỉ được GHI ĐÈ khi truyền tường minh: trang đăng nhập gọi hàm này
 * mà ghi đè thì sẽ xoá mất trang người dùng định vào lúc đầu (AUTH-1 AC2).
 */
export function goToLogin(returnTo?: string): void {
  if (returnTo) sessionStorage.setItem('vpp:returnTo', returnTo);
  window.location.assign('/api/auth/login');
}

/** Lấy lại trang người dùng định vào trước khi bị đẩy đi đăng nhập (AUTH-1 AC2). */
export function takeReturnTo(): string | null {
  const target = sessionStorage.getItem('vpp:returnTo');
  sessionStorage.removeItem('vpp:returnTo');
  return target;
}

/**
 * Xem có trang chờ quay lại hay không mà KHÔNG lấy đi.
 * Dùng để hoãn các phép chuyển hướng mặc định ở `/`: chuyển hướng trước thì
 * `takeReturnTo` không bao giờ chạy nữa và người dùng mất chỗ định vào.
 */
export function hasReturnTo(): boolean {
  return sessionStorage.getItem('vpp:returnTo') !== null;
}
