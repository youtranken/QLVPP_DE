import { useMemo, useRef, useState } from 'react';
import { activeNeed } from '@/lib/report-qty';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { basisNeedOf } from '@/features/send-adm/send-adm-rows';
import { markNoOrder, useRefreshSendState, type SentSnapshot } from '@/features/send-adm/send-adm.api';
import { useNoOrderConfirm } from '@/features/send-adm/use-send-adm-confirms';
import type { MonthReport, SnapshotData } from './reports.api';
import type { OrderQty } from './use-order-qty';

// Đề nghị khởi tạo từ bản đã gửi: mọi khóa của bản (khóa vắng ở báo cáo sống bị bỏ qua)
export const initialFromSent = (sent: SnapshotData | undefined): Record<string, number> | undefined => sent?.order_qty;

// Món đã đổi sau bản đã gửi: cần nay + phần đã giao sau bản ≠ cần lúc chốt, món mới có, món đã rời báo cáo
export function changedKeys(report: Pick<MonthReport, 'byItem' | 'custom'>, sent: SentSnapshot | null, delivered: Record<string, number>): Set<string> {
  const out = new Set<string>();
  if (!sent) return out;
  const was = new Map([...sent.data.byItem, ...sent.data.custom].map((r) => [r.key, r]));
  const live = new Set<string>();
  for (const r of [...report.byItem, ...report.custom]) {
    live.add(r.key);
    const old = was.get(r.key);
    if (!old || activeNeed(r) + (delivered[r.key] ?? 0) !== basisNeedOf(sent.data, old)) out.add(r.key);
  }
  for (const [key] of was) if (!live.has(key) && (sent.data.order_qty[key] ?? 0) > 0) out.add(key);
  return out;
}

// Sau khi chốt thành công, số đang có thành mốc: rời trang không hỏi nữa cho tới khi sửa tiếp
export function useDirtyCount(qty: OrderQty, fresh: ReadonlySet<string>) {
  const sig = `${JSON.stringify(qty.edited)}|${qty.errorCount}`;
  const sentSig = useRef(sig);
  // Số khởi tạo từ bản đã gửi không phải thay đổi chưa chốt
  const [exported, setExported] = useState<string | null>(sig);
  const [seen, setSeen] = useState(0);
  if (fresh.size !== seen) {
    setSeen(fresh.size);
    setExported(sentSig.current);
  }
  return { count: sig === exported ? 0 : qty.editedCount, mark: () => (sentSig.current = sig) };
}

export function useNoOrder(ym: string, qty: OrderQty) {
  const { csrfToken } = useMe();
  const ask = useNoOrderConfirm();
  const refresh = useRefreshSendState(ym);
  const flight = useSingleFlight();
  const [failed, setFailed] = useState<string | null>(null);
  const run = () =>
    flight.run(async () => {
      if (!(await ask())) return;
      setFailed(null);
      try {
        await markNoOrder(ym, qty.edited, csrfToken);
      } catch (e) {
        setFailed(apiErrorCode(e) ?? 'UNKNOWN');
      }
      await refresh();
    });
  return { run, pending: flight.pending, failed };
}

export function useChangedKeys(report: MonthReport, sent: SentSnapshot | null, delivered: Record<string, number>) {
  return useMemo(() => changedKeys(report, sent, delivered), [report, sent, delivered]);
}
