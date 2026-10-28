import { apiErrorCode } from '@/lib/api-error';
import { ApiError } from '@/lib/api-client';

const SYNC_CODES = new Set(['SSO_UNAVAILABLE', 'DIRECTORY_UNAVAILABLE', 'DIRECTORY_AUTH_FAILED', 'DIRECTORY_SYNC_FAILED']);

export function syncErrorKey(e: unknown): string {
  const code = apiErrorCode(e);
  return code && SYNC_CODES.has(code) ? `users.errors.${code}` : 'users.errors.UNKNOWN';
}

export function configErrorField(e: unknown): string | null {
  if (apiErrorCode(e) !== 'CONFIG_INVALID' || !(e instanceof ApiError)) return null;
  const field = (e.body as { field?: unknown }).field;
  return typeof field === 'string' ? field : null;
}
