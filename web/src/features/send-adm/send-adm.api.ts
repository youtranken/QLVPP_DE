import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { SnapshotData, SnapshotRef } from '@/features/reports/reports.api';
import { arrivalsPlanQuery } from '@/features/arrivals/arrivals.api';

// Bản chốt có hàng mới nhất của kỳ (mọi loại); bản rỗng cũ không bao giờ là bản này
export interface SentSnapshot {
  id: string;
  kind: string;
  created_at: string;
  items_count: number;
  units_total: number;
  replaces: SnapshotRef | null;
  data: SnapshotData;
}

export interface SendStateDto {
  state: 'unsent' | 'no_order' | 'sent';
  no_order_at: string | null;
  no_order_by_name: string | null;
  sent: SentSnapshot | null;
  changed_after: boolean;
  changed_at: string | null;
  // Đã giao (người đang làm việc) sau bản theo khóa
  delivered_since: Record<string, number>;
}

export const sendStateKey = (ym: string) => ['send-state', ym] as const;

// Server chỉ trả trạng thái cho kỳ đã khóa: kỳ đang mở thì không gọi
export function useSendStateQuery(ym: string, enabled = true) {
  return useQuery({
    queryKey: sendStateKey(ym),
    queryFn: () => apiFetch<SendStateDto>(`/api/admin/periods/${ym}/send-state`),
    enabled,
  });
}

export function useRefreshSendState(ym: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: sendStateKey(ym) });
}

export const markNoOrder = (ym: string, orderQty: Record<string, number>, csrfToken: string | null) =>
  apiFetch<{ no_order_at: string }>(`/api/admin/periods/${ym}/no-order`, { method: 'POST', body: JSON.stringify({ order_qty: orderQty }), csrfToken });

export const clearNoOrder = (ym: string, csrfToken: string | null) =>
  apiFetch<void>(`/api/admin/periods/${ym}/no-order`, { method: 'DELETE', csrfToken });

// Tháng của phần ADM còn nợ giao theo khóa (cho dòng xám); chỉ tải khi có hàng ADM còn nợ
export function useAdmOwedMonths(ym: string, enabled: boolean) {
  const q = useQuery({ ...arrivalsPlanQuery(ym), enabled });
  return useMemo(() => {
    const months = new Map<string, string[]>();
    for (const g of q.data?.makeup ?? []) {
      for (const r of g.rows) if (r.adm_owed > 0) months.set(r.key, [...(months.get(r.key) ?? []), g.ym]);
    }
    return months;
  }, [q.data]);
}
