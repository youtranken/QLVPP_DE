import { apiErrorCode } from '@/lib/api-error';

const SYNC_CODES = new Set(['SSO_UNAVAILABLE', 'DIRECTORY_UNAVAILABLE', 'DIRECTORY_AUTH_FAILED', 'DIRECTORY_SYNC_FAILED']);

export function syncErrorKey(e: unknown): string {
  const code = apiErrorCode(e);
  return code && SYNC_CODES.has(code) ? `users.errors.${code}` : 'users.errors.UNKNOWN';
}
