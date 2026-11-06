import { ApiError } from '@/lib/api-client';
import { apiErrorCode, apiErrorFields } from '@/lib/api-error';

export type TakeFailure = { kind: 'fields'; fields: string[] } | { kind: 'invalid-period' } | { kind: 'block'; code: 'UNKNOWN' | 'ORDER_EMPTY' };

// VALIDATION order_qty.<khóa> → ô của hàng đó; tháng chưa tới → về tháng mặc định; còn lại → khối đầu trang
export function takeFailure(e: unknown): TakeFailure {
  const code = apiErrorCode(e);
  if (code === 'VALIDATION') return { kind: 'fields', fields: apiErrorFields(e) };
  if (code === 'INVALID_PERIOD') return { kind: 'invalid-period' };
  if (code === 'ORDER_EMPTY') return { kind: 'block', code };
  return { kind: 'block', code: 'UNKNOWN' };
}

export type DownloadError = 'DOWNLOAD_FAILED' | 'SNAPSHOT_NOT_FOUND';

// 401 đã chuyển sang đăng nhập lại ở api-client, không báo thêm
export function downloadFailure(e: unknown): DownloadError | null {
  if (e instanceof ApiError && e.status === 401) return null;
  return apiErrorCode(e) === 'SNAPSHOT_NOT_FOUND' ? 'SNAPSHOT_NOT_FOUND' : 'DOWNLOAD_FAILED';
}
