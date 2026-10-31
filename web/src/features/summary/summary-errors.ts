import { apiErrorCode, apiErrorNumber, apiErrorString } from '@/lib/api-error';

type T = (key: string, opts?: Record<string, unknown>) => string;

export interface AdjustErrors {
  lines?: Record<string, string>;
  reason?: string;
  block?: string;
}

export interface CreateErrors {
  user?: string;
  lines?: Record<string, string>;
  linesMissing?: string;
  block?: string;
  exists?: { requestId?: string };
}

const LINE_CODES = new Set([
  'QTY_BELOW_DELIVERED',
  'QTY_INVALID',
  'QTY_EXCEEDS_MAX',
  'ITEM_INACTIVE',
  'ITEM_NOT_FOUND',
  'ADMIN_ONLY_ITEM',
  'DUPLICATE_ITEM',
  'LINE_NOT_FOUND',
]);
const ADJUST_BLOCK_CODES = new Set(['REQUEST_NOT_FOUND', 'PERIOD_LOCKED', 'DUPLICATE_ITEM']);
const USER_CODES = new Set(['USER_NOT_FOUND', 'USER_INACTIVE', 'USER_IS_ADMIN']);

export const isStaleUpdate = (e: unknown) => apiErrorCode(e) === 'STALE_UPDATE';

// Dòng mới chưa có id → server trỏ bằng line_index = vị trí trong body; keys[i] là khóa hiển thị của dòng thứ i
function lineKeyOf(e: unknown, keys: string[]): string | undefined {
  const index = apiErrorNumber(e, 'line_index');
  if (index !== undefined) return keys[index];
  const id = apiErrorString(e, 'line_id');
  return id && keys.includes(id) ? id : undefined;
}

function lineMessage(e: unknown, t: T): string {
  const code = apiErrorCode(e) ?? '';
  return t(`summary.adjust.errors.line.${LINE_CODES.has(code) ? code : 'OTHER'}`, {
    max: apiErrorNumber(e, 'max'),
    delivered: apiErrorNumber(e, 'delivered'),
  });
}

export function adjustFailure(e: unknown, keys: string[], t: T): AdjustErrors {
  const code = apiErrorCode(e) ?? '';
  if (code === 'REASON_REQUIRED') return { reason: t('summary.adjust.errors.REASON_REQUIRED') };
  const key = lineKeyOf(e, keys);
  if (key) return { lines: { [key]: lineMessage(e, t) } };
  return { block: t(`summary.adjust.errors.${ADJUST_BLOCK_CODES.has(code) ? code : 'UNKNOWN'}`) };
}

export function createFailure(e: unknown, keys: string[], t: T): CreateErrors {
  const code = apiErrorCode(e) ?? '';
  if (code === 'REQUEST_EXISTS') return { exists: { requestId: apiErrorString(e, 'request_id') } };
  if (USER_CODES.has(code)) return { user: t(`summary.create.errors.${code}`) };
  if (code === 'LINES_EMPTY') return { linesMissing: t('summary.create.needLines') };
  const key = lineKeyOf(e, keys);
  if (key) return { lines: { [key]: lineMessage(e, t) } };
  return { block: t(`summary.create.errors.${code === 'PERIOD_LOCKED' ? code : 'UNKNOWN'}`) };
}
