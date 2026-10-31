import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { monthOf } from '@/features/request/request-format';
import { createSnapshot, downloadSnapshot, printPath, useRefreshSnapshots, useReloadReport, type MonthReport, type SnapshotKind } from './reports.api';
import { downloadFailure, takeFailure, type DownloadError } from './reports-errors';
import type { OrderQty } from './use-order-qty';

export type SnapshotDownload = ReturnType<typeof useSnapshotDownload>;

// Tải lại dùng đúng bản đã chốt, không tạo bản mới; lỗi tải hiện ở mục Bản chốt kèm "Thử lại"
export function useSnapshotDownload(ym: string) {
  const { i18n } = useTranslation();
  const flight = useSingleFlight();
  const [failure, setFailure] = useState<{ id: string; error: DownloadError } | null>(null);
  const download = async (id: string) => {
    setFailure(null);
    try {
      await downloadSnapshot(id, i18n.language, ym);
      return true;
    } catch (e) {
      const error = downloadFailure(e);
      if (error) setFailure({ id, error });
      return false;
    }
  };
  return {
    download,
    run: (id: string) => flight.run(async () => void (await download(id))),
    pending: flight.pending,
    failure,
  };
}

const hourOf = (iso: string) => formatVnStamp(iso).split(' ')[0];

function useAnnounce(ym: string, files: SnapshotDownload) {
  const { t } = useTranslation();
  const toast = useToast();
  const when = { month: monthOf(ym), year: ym.slice(0, 4) };
  return async (kind: SnapshotKind, id: string, at: string) => {
    const time = hourOf(at);
    if (kind === 'print') {
      const open = () => window.open(printPath(id), '_blank', 'noopener');
      return toast.show({ text: t('reports.page.toast.print', { ...when, time }), tone: 'ok', action: { label: t('reports.page.toast.openPrint'), onClick: open } });
    }
    if (await files.download(id)) toast.show({ text: t('reports.page.toast.xlsx', { ...when, time }), tone: 'ok' });
  };
}

// Ô gửi đi luôn hợp lệ phía trình duyệt: khóa bị từ chối mà không còn trong báo cáo mới = dòng đã biến mất
function useRejectFields(ym: string, qty: OrderQty) {
  const reloadReport = useReloadReport(ym);
  return async (fields: string[]) => {
    const fresh = await reloadReport();
    const keys = new Set([...(fresh?.byItem ?? []), ...(fresh?.custom ?? [])].map((r) => r.key));
    const still = fields.filter((f) => !f.startsWith('order_qty.') || keys.has(f.slice('order_qty.'.length)));
    qty.reject(still);
    return still.length < fields.length ? ('REPORT_CHANGED' as const) : null;
  };
}

function usePostSnapshot(report: MonthReport, qty: OrderQty, files: SnapshotDownload, onInvalidPeriod: () => boolean) {
  const { csrfToken } = useMe();
  const refresh = useRefreshSnapshots(report.ym);
  const announce = useAnnounce(report.ym, files);
  const rejectFields = useRejectFields(report.ym, qty);
  const flight = useSingleFlight();
  const [notice, setNotice] = useState<'REPORT_CHANGED' | 'UNKNOWN' | 'INVALID_PERIOD' | null>(null);
  const [rejected, setRejected] = useState(false);
  const [taking, setTaking] = useState<SnapshotKind | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const post = (kind: SnapshotKind) =>
    flight.run(async () => {
      setTaking(kind);
      setRejected(false);
      try {
        const { id, created_at } = await createSnapshot(report.ym, { kind, order_qty: qty.edited }, csrfToken);
        setFresh((s) => new Set(s).add(id));
        void refresh();
        await announce(kind, id, created_at);
      } catch (e) {
        const failure = takeFailure(e);
        // Đã ở tháng mặc định mà vẫn chưa tới (đồng hồ máy chủ lệch) → không có chỗ để về, báo ở đầu trang
        if (failure.kind === 'invalid-period') return void (onInvalidPeriod() || setNotice('INVALID_PERIOD'));
        if (failure.kind === 'block') return setNotice(failure.code);
        setRejected(true);
        setNotice(await rejectFields(failure.fields));
      } finally {
        setTaking(null);
      }
    });
  return { post, pending: flight.pending, taking, fresh, notice, rejected, clearNotice: () => setNotice(null) };
}

// Mỗi lần Xuất/In là một bản chốt mới (quyết định chủ sản phẩm); chỉ gửi ô khác Cần mua, server vẫn kiểm 0–99 999
export function useTakeSnapshot(report: MonthReport, qty: OrderQty, files: SnapshotDownload, onInvalidPeriod: () => boolean) {
  const sender = usePostSnapshot(report, qty, files, onInvalidPeriod);
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState<SnapshotKind | null>(null);
  if (tried && qty.errorCount === 0) setTried(false);

  const take = (kind: SnapshotKind) => {
    if (sender.pending) return;
    sender.clearNotice();
    if (qty.errorCount > 0) return setTried(true);
    if (report.pending_custom_count > 0) return setAsking(kind);
    void sender.post(kind);
  };

  return {
    take,
    taking: sender.taking,
    fresh: sender.fresh,
    notice: sender.notice,
    fixCount: tried || sender.rejected ? qty.errorCount : 0,
    asking,
    confirm: () => {
      const kind = asking;
      setAsking(null);
      if (kind) void sender.post(kind);
    },
    cancel: () => setAsking(null),
  };
}
