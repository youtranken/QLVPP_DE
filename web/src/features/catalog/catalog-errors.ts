import { apiErrorCode, apiErrorFields } from '@/lib/api-error';

const KNOWN = new Set([
  'IMAGE_REQUIRED',
  'FILE_TYPE_INVALID',
  'FILE_TOO_LARGE',
  'FILE_FORBIDDEN',
  'UNIT_REQUIRED',
  'ITEM_CODE_EXISTS',
  'ITEM_NOT_FOUND',
  'CATEGORY_EXISTS',
  'CATEGORY_NOT_FOUND',
  'VALIDATION',
]);

export function catalogErrorKey(e: unknown): string {
  const code = apiErrorCode(e);
  return code && KNOWN.has(code) ? `catalog.errors.${code}` : 'catalog.errors.UNKNOWN';
}

// Giá trị là khóa i18n; 'form' = lỗi không thuộc ô nào
export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(e: unknown, fieldOfCode: Record<string, string>, knownFields: string[]): FieldErrors {
  const code = apiErrorCode(e);
  if (code === 'VALIDATION') {
    const fields = apiErrorFields(e).filter((f) => knownFields.includes(f));
    if (fields.length > 0) return Object.fromEntries(fields.map((f) => [f, 'catalog.errors.FIELD_INVALID']));
  }
  const field = code ? fieldOfCode[code] : undefined;
  return { [field ?? 'form']: catalogErrorKey(e) };
}
