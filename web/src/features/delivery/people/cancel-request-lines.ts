import type { DeliveryPerson } from './delivery-people.api';

// Cùng tập dòng server hủy: dòng hiệu lực còn phần chưa giao (chờ duyệt không đụng)
export const cancellableLines = (p: DeliveryPerson) => p.lines.filter((l) => l.remaining_qty > 0 && l.review_status !== 'pending');

export const canCancelRequest = (p: DeliveryPerson) => p.user_status !== 'active' && cancellableLines(p).length > 0;
