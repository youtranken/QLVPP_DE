import { formatPeriod, type RequestStatus } from '@vpp/shared';

/** Nhãn hiển thị kỳ (tiếng Việt), tách khỏi component (business logic ở lib). */
export function periodLabel(period: string): string {
  return formatPeriod(period);
}

/** Dịch kỳ 'YYYY-MM' đi `months` tháng (âm = lùi về trước). */
export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return DATE_TIME.format(typeof value === 'string' ? new Date(value) : value);
}

/** Nhãn + màu của trạng thái đơn, dùng chung cho Tag ở mọi màn. */
/**
 * Màu đi theo MỨC ĐỘ CẦN CHÚ Ý, không phải theo thứ tự bảng chữ cái:
 * cam = đang chờ ai đó làm gì → xanh dương = đã xử lý, đang chờ giao →
 * xanh lá = xong việc. Trước đây "Đã gửi" màu xanh dương nhạt nên trông *ít*
 * khẩn hơn "Đã giao" — ngược hẳn với thực tế.
 */
export const STATUS_META: Record<RequestStatus, { label: string; color: string }> = {
  submitted: { label: 'Đã gửi', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'blue' },
  rejected: { label: 'Bị từ chối', color: 'red' },
  delivered: { label: 'Đã giao', color: 'green' },
  cancelled: { label: 'Đã huỷ', color: 'default' },
};
