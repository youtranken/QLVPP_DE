import { useState } from 'react';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import type { ArrivalRow } from './arrival-rows';
import { postCustomReceipt, postReceipt, type PlanCustomRow } from './arrivals.api';
import { useRefreshArrivals } from './use-arrivals-plan';

export type Notice =
  | { kind: 'saved'; n: number }
  | { kind: 'error'; code: string; itemId?: string }
  | { kind: 'partial'; x: number; n: number }
  | { kind: 'customFailed'; n: number }
  | { kind: 'makeup'; ym: string; code: string }
  | null;

// Lưu một đợt (tất cả hoặc không) và "Đủ hàng" dùng chung một luồng chống bấm đúp
export function useArrivalsSave(ym: string) {
  const { csrfToken } = useMe();
  const flight = useSingleFlight();
  const refresh = useRefreshArrivals(ym);
  const [notice, setNotice] = useState<Notice>(null);

  const fail = (e: unknown) => setNotice({ kind: 'error', code: apiErrorCode(e) ?? 'UNKNOWN', itemId: apiErrorString(e, 'item_id') });

  const save = (lines: { row: ArrivalRow; qty: number }[], note: string, snapshotId: string | null, onDone: () => void) =>
    flight.run(async () => {
      try {
        const body = lines.map(({ row, qty }) => ({ item_id: row.item_id, qty, expected_stock_qty: row.stock }));
        await postReceipt({ lines: body, ym, ...(note.trim() ? { note: note.trim() } : {}), snapshot_id: snapshotId }, csrfToken);
        onDone();
        setNotice({ kind: 'saved', n: body.length });
      } catch (e) {
        fail(e);
      }
      await refresh();
    });

  // Tủ lưu một lần, món ngoài DM ghi từng khóa sau đó: lỗi giữa chừng thì báo rõ phần đã lưu (thử lại an toàn: tủ còn 0, ngoài DM có expected_received)
  const full = (rows: ArrivalRow[], custom: PlanCustomRow[], snapshotId: string | null, onStocked: () => void) =>
    flight.run(async () => {
      let stocked = false;
      let recorded = 0;
      try {
        if (rows.length > 0) {
          await postReceipt({ lines: rows.map((r) => ({ item_id: r.item_id, qty: r.remaining, expected_stock_qty: r.stock })), ym, snapshot_id: snapshotId }, csrfToken);
          stocked = true;
        }
        for (const c of custom) {
          await postCustomReceipt(ym, { line_key: c.key, qty: c.remaining, expected_received: c.received, snapshot_id: snapshotId }, csrfToken);
          recorded += 1;
        }
        setNotice(null);
        onStocked();
      } catch (e) {
        if (stocked) {
          setNotice({ kind: 'partial', x: rows.length, n: custom.length - recorded });
          onStocked();
        } else if (rows.length === 0 && custom.length > 0 && apiErrorCode(e) !== 'STALE_UPDATE') {
          setNotice({ kind: 'customFailed', n: custom.length - recorded });
        } else fail(e);
      }
      await refresh();
    });

  return { pending: flight.pending, notice, setNotice, save, full, refresh };
}
