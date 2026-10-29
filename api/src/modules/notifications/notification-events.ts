export type NotificationTopic =
  | 'period_open'
  | 'reminder'
  | 'period_locked'
  | 'request_delivered'
  | 'line_review'
  | 'custom_line_new'
  | 'low_stock'
  | 'line_cancelled';

// event_id tất định (§9): UNIQUE (event_id, user_sub) chống gửi trùng khi cron/tx chạy lại
export const eventIds = {
  periodOpen: (ym: string) => `period_open:${ym}`,
  reminder: (ym: string) => `reminder:${ym}`,
  periodLocked: (ym: string) => `period_locked:${ym}`,
  requestDelivered: (requestId: string, n: number) =>
    `request_delivered:${requestId}:${n}`,
  lineReview: (lineId: string) => `line_review:${lineId}`,
  customLineNew: (lineId: string) => `custom_line_new:${lineId}`,
  lowStock: (itemId: string, purchaseMovementId: string | null) =>
    `low_stock:${itemId}:${purchaseMovementId ?? '0'}`,
  lineCancelled: (lineId: string, cancelledQty: number) =>
    `line_cancelled:${lineId}:${cancelledQty}`,
};
