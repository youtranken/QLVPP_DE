import { apiErrorCode, apiErrorFields, apiErrorNumber } from '@/lib/api-error';

const KNOWN = new Set(['REASON_REQUIRED', 'USER_INACTIVE', 'USER_NOT_FOUND', 'ITEM_NOT_FOUND', 'VALIDATION']);

// Ô của form: qty (số lượng/thay đổi), reason (lý do/ghi chú), recipient, form (khối)
export type StockField = 'qty' | 'reason' | 'recipient' | 'form';
export type StockErrors = Partial<Record<StockField, string>>;

const FIELD_OF_CODE: Record<string, StockField> = {
  STOCK_INSUFFICIENT: 'qty',
  REASON_REQUIRED: 'reason',
  USER_INACTIVE: 'recipient',
  USER_NOT_FOUND: 'recipient',
};

const FIELD_OF_API: Record<string, StockField> = {
  delta: 'qty',
  qty: 'qty',
  note: 'reason',
  reason: 'reason',
  recipient_sub: 'recipient',
};

type Translate = (key: string, opts?: Record<string, unknown>) => string;

// Trả chuỗi đã dịch vì STOCK_INSUFFICIENT chèn số còn lại và ĐVT của món
export function stockErrors(e: unknown, t: Translate, unit: string): StockErrors {
  const code = apiErrorCode(e);
  if (code === 'STOCK_INSUFFICIENT') {
    return { qty: t('stock.errors.STOCK_INSUFFICIENT', { available: apiErrorNumber(e, 'available') ?? 0, unit }) };
  }
  if (code === 'VALIDATION') {
    const fields = apiErrorFields(e).flatMap((f) => (FIELD_OF_API[f] ? [FIELD_OF_API[f]] : []));
    if (fields.length > 0) return Object.fromEntries(fields.map((f) => [f, t('stock.errors.FIELD_INVALID')]));
  }
  const message = t(code && KNOWN.has(code) ? `stock.errors.${code}` : 'stock.errors.UNKNOWN');
  return { [(code && FIELD_OF_CODE[code]) || 'form']: message };
}
