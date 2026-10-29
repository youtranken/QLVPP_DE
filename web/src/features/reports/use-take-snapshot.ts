import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorFields } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useConfirm } from '@/ui/confirm-context';
import { createSnapshot, downloadSnapshot, printPath, useRefreshSnapshots, useReloadReport, type MonthReport, type SnapshotKind } from './reports.api';
import type { OrderQty } from './use-order-qty';

const NOTICES = new Set(['INVALID_PERIOD', 'VALIDATION']);

// Mỗi lần bấm Xuất/In là một bản chốt mới (quyết định chủ sản phẩm); tải lại/in lại đi qua danh sách
export function useTakeSnapshot(report: MonthReport, qty: OrderQty) {
  const { t, i18n } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const refresh = useRefreshSnapshots(report.ym);
  const reloadReport = useReloadReport(report.ym);
  const flight = useSingleFlight();
  const [notice, setNotice] = useState<string | null>(null);

  const askPending = () =>
    confirm({
      title: t('reports.pendingConfirm.title'),
      message: t('reports.pendingConfirm.message', { count: report.pending_custom_count }),
      confirmLabel: t('reports.pendingConfirm.ok'),
      cancelLabel: t('reports.pendingConfirm.cancel'),
    });

  const take = (kind: SnapshotKind) =>
    flight.run(async () => {
      setNotice(null);
      if (report.pending_custom_count > 0 && !(await askPending())) return;
      try {
        const { id } = await createSnapshot(report.ym, { kind, order_qty: qty.edited }, csrfToken);
        void refresh();
        if (kind === 'print') return navigate(printPath(id));
        // Bản chốt đã có: lỗi tải chỉ cần "Tải lại" ở danh sách, không chốt thêm bản nữa
        await downloadSnapshot(id, i18n.language, report.ym).catch(() => setNotice('DOWNLOAD_FAILED'));
      } catch (e) {
        const code = apiErrorCode(e);
        if (code === 'VALIDATION') return setNotice(await rejectedOrChanged(apiErrorFields(e)));
        setNotice(code && NOTICES.has(code) ? code : 'UNKNOWN');
      }
    });

  // Ô gửi đi luôn hợp lệ phía trình duyệt: khóa bị từ chối mà không còn trong báo cáo mới = dòng đã biến mất
  const rejectedOrChanged = async (fields: string[]) => {
    const fresh = await reloadReport();
    const keys = new Set([...(fresh?.byItem ?? []), ...(fresh?.custom ?? [])].map((r) => r.key));
    const still = fields.filter((f) => !f.startsWith('order_qty.') || keys.has(f.slice('order_qty.'.length)));
    qty.reject(still);
    return still.length < fields.length ? 'REPORT_CHANGED' : 'VALIDATION';
  };

  return { take, pending: flight.pending, notice };
}
