import { ApiError } from '@/lib/api-client';

function bodyOf(e: unknown): Record<string, unknown> | null {
  if (!(e instanceof ApiError) || typeof e.body !== 'object' || e.body === null) return null;
  return e.body as Record<string, unknown>;
}

export function apiErrorCode(e: unknown): string | undefined {
  const code = bodyOf(e)?.code;
  return typeof code === 'string' ? code : undefined;
}

export function apiErrorFields(e: unknown): string[] {
  const fields = bodyOf(e)?.fields;
  return Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [];
}

export function apiErrorNumber(e: unknown, key: string): number | undefined {
  const value = bodyOf(e)?.[key];
  return typeof value === 'number' ? value : undefined;
}

export function apiErrorString(e: unknown, key: string): string | undefined {
  const value = bodyOf(e)?.[key];
  return typeof value === 'string' ? value : undefined;
}
