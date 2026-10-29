import { apiErrorCode, apiErrorNumber } from '@/lib/api-error';

type T = (key: string, opts?: Record<string, unknown>) => string;

// Lỗi của cả phiếu (báo ở đầu phiếu, tải lại phiếu) khác lỗi số lượng (gắn vào ô "Thực giao")
const REQUEST_CODES = new Set([
  'STALE_UPDATE',
  'PERIOD_NOT_LOCKED',
  'LINE_NOT_REVIEWED',
  'LINE_REJECTED',
  'LINE_NOT_FOUND',
  'REQUEST_NOT_FOUND',
]);

export type LineFailure =
  | { kind: 'request'; code: string }
  | { kind: 'field'; limit?: number; message: string; stale?: boolean };

export function lineFailure(e: unknown, t: T): LineFailure {
  const code = apiErrorCode(e) ?? '';
  if (REQUEST_CODES.has(code)) return { kind: 'request', code };
  if (code === 'STOCK_INSUFFICIENT') {
    const available = apiErrorNumber(e, 'available') ?? 0;
    return { kind: 'field', limit: available, message: t('delivery.line.available', { available }) };
  }
  if (code === 'DELIVER_EXCEEDS_QTY') {
    const remaining = apiErrorNumber(e, 'remaining') ?? 0;
    // Phần còn lại đổi mà số đã giao không đổi (hủy nợ ở nơi khác): bản phiếu đang xem đã cũ
    return { kind: 'field', limit: remaining, message: t('delivery.line.exceeds', { remaining }), stale: true };
  }
  if (code === 'VALIDATION') return { kind: 'field', message: t('delivery.line.invalid') };
  return { kind: 'field', message: t('delivery.line.failed') };
}

export const noticeOf = (code: string, t: T) => t(`delivery.notice.${REQUEST_CODES.has(code) ? code : 'UNKNOWN'}`);
