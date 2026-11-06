import { apiErrorCode, apiErrorNumber, apiErrorString } from '@/lib/api-error';

type T = (key: string, opts?: Record<string, unknown>) => string;

export interface AdjustErrors {
  lines?: Record<string, string>;
  block?: string;
}

const LINE_CODES = new Set(['QTY_BELOW_DELIVERED', 'QTY_INCREASE_FORBIDDEN', 'REASON_REQUIRED', 'LINE_NOT_FOUND', 'LINE_MISSING']);
const ADJUST_BLOCK_CODES = new Set(['REQUEST_NOT_FOUND', 'PERIOD_NOT_LOCKED']);

export const isStaleUpdate = (e: unknown) => apiErrorCode(e) === 'STALE_UPDATE';

// Server trỏ dòng bằng line_id, hoặc line_index = vị trí trong body (lỗi DTO); keys[i] là id dòng thứ i
function lineKeyOf(e: unknown, keys: string[]): string | undefined {
  const index = apiErrorNumber(e, 'line_index');
  if (index !== undefined) return keys[index];
  const id = apiErrorString(e, 'line_id');
  return id && keys.includes(id) ? id : undefined;
}

function lineMessage(e: unknown, t: T): string {
  const code = apiErrorCode(e) ?? '';
  // Lỗi DTO của ghi chú dòng: quá 200 ký tự
  const key = code === 'VALIDATION' ? 'NOTE_TOO_LONG' : LINE_CODES.has(code) ? code : 'OTHER';
  return t(`summary.adjust.errors.line.${key}`, { delivered: apiErrorNumber(e, 'delivered') });
}

export function adjustFailure(e: unknown, keys: string[], t: T): AdjustErrors {
  const code = apiErrorCode(e) ?? '';
  const key = lineKeyOf(e, keys);
  if (key) return { lines: { [key]: lineMessage(e, t) } };
  return { block: t(`summary.adjust.errors.${ADJUST_BLOCK_CODES.has(code) ? code : 'UNKNOWN'}`) };
}
