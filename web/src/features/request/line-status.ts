import { requestStatus, type RequestStatus } from '@/lib/request-status';
import type { LineView } from './request.api';

export function linesStatus(lines: Pick<LineView, 'qty' | 'delivered_qty' | 'cancelled_qty'>[]): RequestStatus {
  return requestStatus({
    qty: lines.reduce((n, l) => n + l.qty, 0),
    delivered: lines.reduce((n, l) => n + l.delivered_qty, 0),
    cancelled: lines.reduce((n, l) => n + l.cancelled_qty, 0),
  });
}
