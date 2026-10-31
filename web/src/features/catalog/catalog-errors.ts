import { apiErrorCode, apiErrorFields } from '@/lib/api-error';

const KNOWN = new Set([
  'IMAGE_REQUIRED',
  'FILE_TYPE_INVALID',
  'FILE_TOO_LARGE',
  'FILE_FORBIDDEN',
  'UNIT_REQUIRED',
  'UNIT_INACTIVE',
  'ITEM_CODE_EXISTS',
  'ITEM_IN_USE',
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

// prefix: form món lồng trong body khác (review gửi {item: {...}} → server báo 'item.max_qty')
export function fieldErrors(e: unknown, fieldOfCode: Record<string, string>, knownFields: string[], prefix = ''): FieldErrors {
  const code = apiErrorCode(e);
  if (code === 'VALIDATION') {
    const fields = apiErrorFields(e)
      .flatMap((f) => (f.startsWith(prefix) ? [f.slice(prefix.length)] : []))
      .filter((f) => knownFields.includes(f));
    if (fields.length > 0) return Object.fromEntries(fields.map((f) => [f, 'catalog.errors.FIELD_INVALID']));
  }
  const field = code ? fieldOfCode[code] : undefined;
  return { [field ?? 'form']: catalogErrorKey(e) };
}

// Lỗi một món trong bảng (sửa tại chỗ, công tắc, hàng loạt): hiện tại hàng, không toast
export function rowErrorText(e: unknown, t: (key: string) => string): string {
  if (apiErrorCode(e) === 'VALIDATION' && apiErrorFields(e).includes('max_qty')) return t('catalog.list.maxRange');
  return t(catalogErrorKey(e));
}
