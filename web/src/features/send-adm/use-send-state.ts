import { useMemo } from 'react';
import { useSendStateQuery } from './send-adm.api';

const NONE: Record<string, number> = {};

// Phần đã giao + phần hủy vì NCC hết hàng sau bản, theo khóa: cả hai là hệ quả của nhận/giao hàng kỳ này, không đổi đơn
export function mergeSettled(delivered: Record<string, number>, admCancelled: Record<string, number>): Record<string, number> {
  const out = { ...delivered };
  for (const [key, n] of Object.entries(admCancelled)) out[key] = (out[key] ?? 0) + n;
  return out;
}

export function useSendState(ym: string, enabled = true) {
  const query = useSendStateQuery(ym, enabled);
  const d = query.data;
  const delivered = d?.delivered_since ?? NONE;
  const admCancelled = d?.adm_cancelled_since ?? NONE;
  const settledSince = useMemo(() => mergeSettled(delivered, admCancelled), [delivered, admCancelled]);
  return {
    query,
    state: d?.state,
    sent: d?.sent ?? null,
    changedAfter: d?.changed_after ?? false,
    changedAt: d?.changed_at ?? null,
    settledSince,
    noOrder: d?.no_order_at ? { at: d.no_order_at, by: d.no_order_by_name } : null,
  };
}

export type SendState = ReturnType<typeof useSendState>;
