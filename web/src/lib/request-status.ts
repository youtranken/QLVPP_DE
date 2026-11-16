export type RequestStatusKey = 'notDelivered' | 'partial' | 'done' | 'owed' | 'cancelled';

export interface RequestStatus {
  key: RequestStatusKey;
  delivered: number;
  total: number;
  n?: number;
}

// Đếm theo đơn vị; phần đã hủy (NCC hết hàng, hủy nợ) ra khỏi mẫu số nên hủy phần còn lại là xong; nợ tháng trước đứng trước mọi trạng thái khác
export function requestStatus(s: { qty: number; delivered: number; cancelled: number; owedPrevMonths?: number }): RequestStatus {
  const base = { delivered: s.delivered, total: s.qty - s.cancelled };
  if (s.owedPrevMonths && s.owedPrevMonths > 0) return { key: 'owed', ...base, n: s.owedPrevMonths };
  if (s.qty > 0 && s.delivered === 0 && s.cancelled >= s.qty) return { key: 'cancelled', ...base };
  if (s.delivered + s.cancelled >= s.qty) return { key: 'done', ...base };
  if (s.delivered === 0) return { key: 'notDelivered', ...base };
  return { key: 'partial', ...base };
}

export function requestStatusText(t: (k: string, o?: Record<string, unknown>) => string, s: RequestStatus): string {
  return t(`common.requestStatus.${s.key}`, { delivered: s.delivered, total: s.total, n: s.n });
}
