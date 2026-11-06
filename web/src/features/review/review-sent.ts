// Điều kiện lấy từ bản chốt có hàng của kỳ dòng: null = kỳ chưa có bản
export interface SentInfo {
  inSnapshot: boolean | null;
  qty: number | null;
  at: string | null;
}

export const sentOf = (row: { in_sent_snapshot: boolean | null; in_sent_snapshot_qty: number | null; in_sent_snapshot_at: string | null }): SentInfo => ({
  inSnapshot: row.in_sent_snapshot,
  qty: row.in_sent_snapshot_qty,
  at: row.in_sent_snapshot_at,
});

// Cảnh báo không chặn: mua món chưa có trong phiếu gửi ADM (buy) / bỏ món đã tính vào phiếu (skip)
export type SentKind = 'buy' | 'skip';

export const sentApplies = (sent: SentInfo | undefined, kind: SentKind): sent is SentInfo & { at: string } =>
  !!sent?.at && (kind === 'buy' ? sent.inSnapshot === false : (sent.qty ?? 0) > 0);
