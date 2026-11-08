import { useState } from 'react';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import type { ArrivalRow } from './arrival-rows';
import { postReceipt } from './arrivals.api';
import { useRefreshArrivals } from './use-arrivals-plan';

export type Notice =
  | { kind: 'saved'; n: number }
  | { kind: 'error'; code: string; itemId?: string }
  | { kind: 'makeup'; ym: string; code: string }
  | null;

// Lưu một đợt (tất cả hoặc không), chống bấm đúp
export function useArrivalsSave(ym: string) {
  const { csrfToken } = useMe();
  const flight = useSingleFlight();
  const refresh = useRefreshArrivals();
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

  return { pending: flight.pending, notice, setNotice, save, refresh };
}
