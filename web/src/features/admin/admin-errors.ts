import { apiErrorCode } from '@/lib/api-error';
import { ApiError } from '@/lib/api-client';

export function configErrorField(e: unknown): string | null {
  if (apiErrorCode(e) !== 'CONFIG_INVALID' || !(e instanceof ApiError)) return null;
  const field = (e.body as { field?: unknown }).field;
  return typeof field === 'string' ? field : null;
}
