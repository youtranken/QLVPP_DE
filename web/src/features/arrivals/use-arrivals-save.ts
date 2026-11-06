import { useState } from 'react';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import type { ArrivalRow } from './arrival-rows';
import { postCustomReceipt, postReceipt, type PlanCustomRow } from './arrivals.api';
import { useRefreshArrivals } from './use-arrivals-plan';

export type Notice = { kind: 'saved'; n: number } | { kind: 'error'; code: string; itemId?: string } | null;

// Lưu một đợt (tất cả hoặc không) và "Đủ hàng" dùng chung một luồng chống bấm đúp
export function useArrivalsSave(ym: string) {
  const { csrfToken } = useMe();
  const flight = useSingleFlight();
  const refresh = useRefreshArrivals(ym);
  const [notice, setNotice] = useState<Notice>(null);

  const fail = (e: unknown) => setNotice({ kind: 'error', code: apiErrorCode(e) ?? 'UNKNOWN', itemId: apiErrorString(e, 'item_id') });

  const save = (lines: { row: ArrivalRow; qty: number }[], note: string, onDone: () => void) =>
    flight.run(async () => {
      try {
        const body = lines.map(({ row, qty }) => ({ item_id: row.item_id, qty, expected_stock_qty: row.stock }));
        await postReceipt({ lines: body, ym, ...(note.trim() ? { note: note.trim() } : {}) }, csrfToken);
        onDone();
        setNotice({ kind: 'saved', n: body.length });
      } catch (e) {
        fail(e);
      }
      await refresh();
    });

  const full = (rows: ArrivalRow[], custom: PlanCustomRow[], onDone: () => void) =>
    flight.run(async () => {
      try {
        if (rows.length > 0) {
          await postReceipt({ lines: rows.map((r) => ({ item_id: r.item_id, qty: r.remaining, expected_stock_qty: r.stock })), ym }, csrfToken);
        }
        for (const c of custom) await postCustomReceipt(ym, { line_key: c.key, qty: c.remaining, expected_received: c.received }, csrfToken);
        setNotice(null);
        onDone();
      } catch (e) {
        fail(e);
      }
      await refresh();
    });

  return { pending: flight.pending, notice, setNotice, save, full, refresh };
}
