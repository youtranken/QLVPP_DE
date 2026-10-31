import { useCallback, useEffect, useRef, useState } from 'react';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { usePersonRows, type PersonRow } from '@/features/summary/summary.api';
import type { useDeliveryParams } from './use-delivery-params';

const LEAVE_MS = 600;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Phiếu đang chọn/vừa giao đủ đã rời bộ lọc vẫn giữ đúng chỗ cũ trong danh sách tới khi chuyển phiếu
function useStickyRows(rows: PersonRow[], keep: ReadonlySet<string>): PersonRow[] {
  const shown = useRef<PersonRow[]>([]);
  const ids = new Set(rows.map((r) => r.request_id));
  const out = [...rows];
  shown.current.forEach((r, i) => {
    if (keep.has(r.request_id) && !ids.has(r.request_id)) out.splice(Math.min(i, out.length), 0, r);
  });
  shown.current = out;
  return out;
}

const without = (s: ReadonlySet<string>, id: string) => new Set([...s].filter((x) => x !== id));

export function useDeliveryBoard(ym: string, p: ReturnType<typeof useDeliveryParams>) {
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const reduced = useMediaQuery(REDUCED_MOTION);
  const pending = usePersonRows(ym, 'pending_delivery', '');
  const all = usePersonRows(p.showAll ? ym : undefined, 'all', '');
  const source = p.showAll ? all : pending;
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const keep = new Set([...leaving, ...(p.requestId ? [p.requestId] : [])]);
  const rows = useStickyRows(source.data?.pages.flatMap((pg) => pg.items) ?? [], keep);
  const pendingRows = pending.data?.pages.flatMap((pg) => pg.items);
  const latest = useRef({ rows, requestId: p.requestId, select: p.select });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    latest.current = { rows, requestId: p.requestId, select: p.select };
  });

  // Màn rộng: luôn có một phiếu đang mở (phiếu đầu); điện thoại giữ danh sách tới khi chạm (S7)
  const firstId = rows[0]?.request_id;
  const { requestId, select } = p;
  useEffect(() => {
    if (!phone && !requestId && firstId) select(firstId, true);
  }, [phone, requestId, firstId, select]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onCompleted = useCallback(
    (id: string) => {
      if (p.showAll) return;
      const leave = () => {
        const { rows: now, requestId: current, select: pick } = latest.current;
        setLeaving((s) => without(s, id));
        if (current !== id) return;
        const order = now.map((r) => r.request_id);
        const i = order.indexOf(id);
        pick(order[i + 1] ?? order[i - 1] ?? null, true);
      };
      setLeaving((s) => new Set([...s, id]));
      if (reduced) leave();
      else timers.current.push(setTimeout(leave, LEAVE_MS));
    },
    [p.showAll, reduced],
  );

  return {
    rows,
    source,
    leaving,
    pendingCount: pending.data && !pending.hasNextPage ? pendingRows?.length : undefined,
    onCompleted,
  };
}
