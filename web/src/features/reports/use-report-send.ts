import { createElement, useMemo, useRef, useState } from 'react';
import { activeNeed } from '@/lib/report-qty';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { basisNeedOf } from '@/features/send-adm/send-adm-rows';
import { markNoOrder, useRefreshSendState, type SentSnapshot } from '@/features/send-adm/send-adm.api';
import { useNoOrderConfirm } from '@/features/send-adm/use-send-adm-confirms';
import { PendingCustomWarning, type PendingCustom } from '@/features/send-adm/send-adm-dialogs';
import { pendingConfirmOf, useReloadReport, type MonthReport, type SnapshotData } from './reports.api';
import type { OrderQty } from './use-order-qty';

// Đề nghị khởi tạo từ bản đã gửi: mọi khóa của bản (khóa vắng ở báo cáo sống bị bỏ qua)
export const initialFromSent = (sent: SnapshotData | undefined): Record<string, number> | undefined => sent?.order_qty;

// Món đã đổi sau bản đã gửi: cần nay + phần đã xong sau bản (giao, hủy vì NCC hết hàng) ≠ cần lúc chốt, món mới có.
// Món rời báo cáo sống (mọi dòng đã giao/hủy hết) chỉ tính đổi khi phần đã xong không bù đủ cần lúc chốt — nhận rồi giao hết hàng kỳ này không phải thay đổi đơn
export function changedKeys(report: Pick<MonthReport, 'byItem' | 'custom'>, sent: SentSnapshot | null, settled: Record<string, number>): Set<string> {
  const out = new Set<string>();
  if (!sent) return out;
  const was = new Map([...sent.data.byItem, ...sent.data.custom].map((r) => [r.key, r]));
  const live = new Set<string>();
  for (const r of [...report.byItem, ...report.custom]) {
    live.add(r.key);
    const old = was.get(r.key);
    if (!old || activeNeed(r) + (settled[r.key] ?? 0) !== basisNeedOf(sent.data, old)) out.add(r.key);
  }
  for (const [key, old] of was) if (!live.has(key) && (sent.data.order_qty[key] ?? 0) > 0 && (settled[key] ?? 0) !== basisNeedOf(sent.data, old)) out.add(key);
  return out;
}

const changedDrafts = (base: Record<string, string>, now: Record<string, string>) =>
  [...new Set([...Object.keys(base), ...Object.keys(now)])].filter((k) => base[k] !== now[k]).length;

// Thay đổi chưa chốt = ô người dùng đã gõ khác mốc. Mốc ban đầu là số khởi tạo từ bản đã gửi (không phải thay đổi);
// sau khi chốt thành công, số đang có thành mốc. So theo ô đã gõ nên tải lại báo cáo không làm hỏi oan
export function useDirtyCount(qty: OrderQty, fresh: ReadonlySet<string>) {
  const taken = useRef(qty.drafts);
  const [base, setBase] = useState(qty.drafts);
  const [seen, setSeen] = useState(0);
  if (fresh.size !== seen) {
    setSeen(fresh.size);
    setBase(taken.current);
  }
  return { count: changedDrafts(base, qty.drafts), mark: () => (taken.current = qty.drafts) };
}

// Không cần đề nghị cũng chốt kỳ: món ngoài danh mục còn chờ được ghi Không mua như khi chốt bản
export function useNoOrder(report: MonthReport, qty: OrderQty, pending: PendingCustom) {
  const ym = report.ym;
  const { csrfToken } = useMe();
  const ask = useNoOrderConfirm();
  const refresh = useRefreshSendState(ym);
  const reloadReport = useReloadReport(ym);
  const flight = useSingleFlight();
  const [failed, setFailed] = useState<string | null>(null);
  const run = () =>
    flight.run(async () => {
      const warning = pending.count > 0 ? createElement(PendingCustomWarning, { pending: pending.count, names: pending.names }) : undefined;
      if (!(await ask(warning))) return;
      setFailed(null);
      const confirm = pendingConfirmOf(report);
      try {
        await markNoOrder(ym, qty.edited, confirm, csrfToken);
        // Món chờ vừa thành Không mua: tải lại để số/tên món chờ trên trang hết cũ
        if (confirm.reject_pending_custom) void reloadReport();
      } catch (e) {
        const code = apiErrorCode(e) ?? 'UNKNOWN';
        setFailed(code);
        // Danh sách món chờ vừa đổi: tải lại để lần hỏi sau hiện đúng tên
        if (code === 'PENDING_CUSTOM') void reloadReport();
      }
      await refresh();
    });
  return { run, pending: flight.pending, failed };
}

export function useChangedKeys(report: MonthReport, sent: SentSnapshot | null, settled: Record<string, number>) {
  return useMemo(() => changedKeys(report, sent, settled), [report, sent, settled]);
}
