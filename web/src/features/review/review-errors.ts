import { apiErrorCode } from '@/lib/api-error';

const KNOWN = new Set([
  'LINE_ALREADY_REVIEWED',
  'LINE_NOT_FOUND',
  'REASON_REQUIRED',
  'ITEM_NOT_FOUND',
  'ITEM_INACTIVE',
  'VALIDATION',
]);

// Dòng đã được người khác xử lý hoặc đã bị xóa khỏi phiếu: đóng hộp và tải lại thay vì báo lỗi ô
const STALE = new Set(['LINE_ALREADY_REVIEWED', 'LINE_NOT_FOUND']);

export const isStaleReview = (e: unknown) => STALE.has(apiErrorCode(e) ?? '');

export function reviewErrorKey(e: unknown): string | undefined {
  const code = apiErrorCode(e);
  return code && KNOWN.has(code) ? `review.errors.${code}` : undefined;
}
