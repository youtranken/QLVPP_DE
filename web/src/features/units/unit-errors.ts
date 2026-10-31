import { apiErrorCode, apiErrorFields } from '@/lib/api-error';

const KNOWN = new Set(['UNIT_EXISTS', 'UNIT_NOT_FOUND', 'UNIT_IN_USE']);

export function unitErrorKey(e: unknown): string {
  const code = apiErrorCode(e);
  if (code === 'VALIDATION') return 'units.errors.FIELD_INVALID';
  return code && KNOWN.has(code) ? `units.errors.${code}` : 'units.errors.UNKNOWN';
}

export const isFieldError = (e: unknown, field: string) =>
  apiErrorCode(e) === 'UNIT_EXISTS' || (apiErrorCode(e) === 'VALIDATION' && apiErrorFields(e).includes(field));
