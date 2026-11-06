import { apiErrorCode, apiErrorNumber } from '@/lib/api-error';
import { lockPhrase } from '@/lib/period-text';

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

export interface DeliveryFailure {
  code: string;
  available?: number;
  remaining?: number;
}

// Trang Giao hàng: lỗi khối ở đầu chi tiết, còn lại gắn vào dòng; mã làm bản phiếu cũ thì tải lại phiếu
const BLOCK_CODES = new Set(['PERIOD_NOT_LOCKED', 'REQUEST_NOT_FOUND', 'LINE_NOT_FOUND']);
const DELIVER_CODES = ['STOCK_INSUFFICIENT', 'DELIVER_EXCEEDS_QTY', 'STALE_UPDATE', 'LINE_NOT_REVIEWED', 'LINE_REJECTED'];
// Hộp giao: dòng ngoài DM giao vượt số đã về; hủy phần thiếu ADM khi khóa vừa bỏ đánh dấu
const LINE_CODES = new Set([...DELIVER_CODES, 'CUSTOM_NOT_RECEIVED', 'ITEM_NOT_ADM_OUT']);
const STALE_CODES = new Set(['DELIVER_EXCEEDS_QTY', 'STALE_UPDATE', 'LINE_NOT_REVIEWED', 'LINE_REJECTED']);

export const isBlockCode = (code: string) => BLOCK_CODES.has(code);
export const makesViewStale = (code: string) => STALE_CODES.has(code) || BLOCK_CODES.has(code);

// Kỳ chưa khóa nói giờ mở theo hạn server trả (câu khóa sổ chung), không suy từ tháng của dòng
export function blockText(code: string, t: T, lang: 'vi' | 'en', deadline?: string): string {
  if (code === 'PERIOD_NOT_LOCKED' && !deadline) return t('delivery.detail.block.PERIOD_NOT_LOCKED_NODATE');
  return t(`delivery.detail.block.${BLOCK_CODES.has(code) ? code : 'UNKNOWN'}`, { lockPhrase: deadline ? lockPhrase(deadline, lang) : '' });
}

export function lineErrorText(f: DeliveryFailure, unit: string, t: T): string {
  return t(`delivery.detail.errors.${LINE_CODES.has(f.code) ? f.code : 'UNKNOWN'}`, {
    available: f.available ?? 0,
    remaining: f.remaining ?? 0,
    unit,
  });
}

const REASON_CODES = new Set([...DELIVER_CODES, 'PERIOD_NOT_LOCKED']);

export function reasonText(f: DeliveryFailure, t: T): string {
  return t(`delivery.result.reasons.${REASON_CODES.has(f.code) ? f.code : 'UNKNOWN'}`, {
    available: f.available ?? 0,
    remaining: f.remaining ?? 0,
  });
}
