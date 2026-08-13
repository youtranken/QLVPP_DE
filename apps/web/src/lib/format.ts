import { formatPeriod, type RequestStatus } from '@vpp/shared';

/** Nhãn hiển thị kỳ (tiếng Việt), tách khỏi component (business logic ở lib). */
export function periodLabel(period: string): string {
  return formatPeriod(period);
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
export const STATUS_META: Record<RequestStatus, { label: string; color: string }> = {
  submitted: { label: 'Đã gửi', color: 'blue' },
  approved: { label: 'Đã duyệt', color: 'green' },
  rejected: { label: 'Bị từ chối', color: 'red' },
  delivered: { label: 'Đã giao', color: 'cyan' },
  cancelled: { label: 'Đã huỷ', color: 'default' },
};
