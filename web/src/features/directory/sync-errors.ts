import { apiErrorCode } from '@/lib/api-error';
import { ApiError } from '@/lib/api-client';

const SYNC_CODES = new Set(['SSO_UNAVAILABLE', 'DIRECTORY_UNAVAILABLE', 'DIRECTORY_AUTH_FAILED', 'DIRECTORY_RATE_LIMITED', 'DIRECTORY_SYNC_FAILED']);

export const syncCodeKey = (code: string) => (SYNC_CODES.has(code) ? `users.errors.${code}` : 'users.errors.UNKNOWN');

export function syncErrorKey(e: unknown): string {
  const code = apiErrorCode(e);
  if (code && SYNC_CODES.has(code)) return `users.errors.${code}`;
  // Mọi 5xx coi như PMH ID không liên lạc được
  return e instanceof ApiError && e.status >= 500 ? 'users.errors.SSO_UNAVAILABLE' : 'users.errors.UNKNOWN';
}
