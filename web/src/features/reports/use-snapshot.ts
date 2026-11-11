import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { monthOf } from '@/features/request/request-format';
import { createSnapshot, downloadSnapshot, pendingConfirmOf, previewSnapshot, useRefreshSnapshots, useReloadReport, type MonthReport, type SnapshotData, type SnapshotKind } from './reports.api';
import { downloadFailure, takeFailure, type BlockCode, type DownloadError } from './reports-errors';
import type { OrderQty } from './use-order-qty';

export interface TakeOptions {
  // Gửi ADM: số trùng bản có hàng mới nhất cùng loại → server dùng lại bản đó
  reuse?: boolean;
  // Hỏi lại trước khi chốt (mặc định: còn món ngoài danh mục chờ xem)
  mustConfirm?: boolean;
  onTaken?: () => void;
  // In tại chỗ từ bản server trả về (không mở tab)
  print?: (data: SnapshotData) => Promise<unknown>;
}

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

function useAnnounceXlsx(ym: string, files: SnapshotDownload) {
  const { t } = useTranslation();
  const toast = useToast();
  const when = { month: monthOf(ym), year: ym.slice(0, 4) };
  return async (id: string, at: string) => {
    if (await files.download(id)) toast.show({ text: t('reports.page.toast.xlsx', { ...when, time: hourOf(at) }), tone: 'ok' });
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

function usePostSnapshot(report: MonthReport, qty: OrderQty, files: SnapshotDownload, onInvalidPeriod: () => boolean, opts: TakeOptions) {
  const { csrfToken } = useMe();
  const refresh = useRefreshSnapshots(report.ym);
  const announceXlsx = useAnnounceXlsx(report.ym, files);
  const rejectFields = useRejectFields(report.ym, qty);
  const reloadReport = useReloadReport(report.ym);
  const flight = useSingleFlight();
  const [notice, setNotice] = useState<'REPORT_CHANGED' | 'INVALID_PERIOD' | BlockCode | null>(null);
  const [rejected, setRejected] = useState(false);
  const [taking, setTaking] = useState<SnapshotKind | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const fail = async (e: unknown): Promise<BlockCode | null> => {
    const failure = takeFailure(e);
    // Đã ở tháng mặc định mà vẫn chưa tới (đồng hồ máy chủ lệch) → không có chỗ để về, báo ở đầu trang
    if (failure.kind === 'invalid-period') {
      if (!onInvalidPeriod()) setNotice('INVALID_PERIOD');
      return null;
    }
    if (failure.kind === 'block') {
      setNotice(failure.code);
      // Danh sách món chờ đã đổi: tải lại để cảnh báo hiện đúng tên mới
      if (failure.code === 'PENDING_CUSTOM') await reloadReport();
      return failure.code;
    }
    setRejected(true);
    setNotice(await rejectFields(failure.fields));
    return null;
  };
  // Trả mã lỗi chặn (nếu có) để hộp hỏi lại giữ mở khi danh sách món chờ vừa đổi
  const post = async (kind: SnapshotKind) => {
    let failed: BlockCode | null = null;
    await flight.run(async () => {
      setTaking(kind);
      setRejected(false);
      try {
        const body = { kind, order_qty: qty.edited, ...pendingConfirmOf(report), ...(opts.reuse ? { reuse_if_unchanged: true } : {}) };
        const { id, created_at, data } = await createSnapshot(report.ym, body, csrfToken);
        setFresh((s) => new Set(s).add(id));
        void refresh();
        if (kind === 'xlsx') await announceXlsx(id, created_at);
        else if (data) await opts.print?.({ ...data, id, kind });
        opts.onTaken?.();
      } catch (e) {
        failed = await fail(e);
      } finally {
        setTaking(null);
      }
    });
    return failed as BlockCode | null;
  };
  // Bản xem trước: cùng ô Đề nghị như lúc chốt, lỗi báo cùng chỗ; không lưu gì nên không đổi fresh/danh sách
  const [previewing, setPreviewing] = useState(false);
  const preview = async () => {
    let data: SnapshotData | null = null;
    await flight.run(async () => {
      setPreviewing(true);
      setRejected(false);
      try {
        data = (await previewSnapshot(report.ym, { order_qty: qty.edited }, csrfToken)).data;
      } catch (e) {
        await fail(e);
      } finally {
        setPreviewing(false);
      }
    });
    return data as SnapshotData | null;
  };
  return { post, preview, previewing, pending: flight.pending, taking, fresh, notice, rejected, clearNotice: () => setNotice(null) };
}

// Chỉ gửi ô đã sửa (ô vắng = số mặc định ở server, server vẫn kiểm 0–99 999); reuse → số trùng bản mới nhất cùng loại thì server dùng lại bản đó
export function useTakeSnapshot(report: MonthReport, qty: OrderQty, files: SnapshotDownload, onInvalidPeriod: () => boolean, opts: TakeOptions = {}) {
  const sender = usePostSnapshot(report, qty, files, onInvalidPeriod, opts);
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState<SnapshotKind | null>(null);
  const [conflict, setConflict] = useState(false);
  if (tried && qty.errorCount === 0) setTried(false);

  const take = (kind: SnapshotKind) => {
    if (sender.pending) return;
    sender.clearNotice();
    if (qty.errorCount > 0) return setTried(true);
    if (opts.mustConfirm ?? report.pending_custom_count > 0) {
      setConflict(false);
      return setAsking(kind);
    }
    void sender.post(kind);
  };

  const ready = () => {
    if (sender.pending) return false;
    sender.clearNotice();
    if (qty.errorCount === 0) return true;
    setTried(true);
    return false;
  };

  return {
    take,
    // "Xem tổng kết": dựng bản sẽ in, chưa lưu gì
    preview: async () => (ready() ? sender.preview() : null),
    previewing: sender.previewing,
    // "Đồng ý và in": cảnh báo đã hiện trong hộp xem trước nên chốt luôn, không hỏi lại
    takeNow: (kind: SnapshotKind) => {
      if (ready()) void sender.post(kind);
    },
    taking: sender.taking,
    fresh: sender.fresh,
    notice: sender.notice,
    fixCount: tried || sender.rejected ? qty.errorCount : 0,
    asking,
    conflict,
    confirming: sender.pending,
    // Hộp hỏi lại mở tới khi chốt xong; danh sách món chờ vừa đổi (409) thì giữ hộp, báo đỏ trong hộp
    confirm: async () => {
      const kind = asking;
      if (!kind) return;
      const failed = await sender.post(kind);
      if (failed === 'PENDING_CUSTOM') {
        sender.clearNotice();
        return setConflict(true);
      }
      setConflict(false);
      setAsking(null);
    },
    cancel: () => {
      setConflict(false);
      setAsking(null);
    },
  };
}
