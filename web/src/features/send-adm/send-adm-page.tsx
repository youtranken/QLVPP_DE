import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { shiftYm } from '@/lib/ym';
import { Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { useAdminConfig } from '@/features/admin/admin.api';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { currentPeriodQuery, useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { useMonthReport } from '@/features/reports/reports.api';
import { useSnapshotDownload } from '@/features/reports/use-snapshot';
import { PeriodLockGate } from '@/features/summary/period-lock-gate';
import { usePeriodSummary } from '@/features/summary/summary.api';
import { SendAdmDraft } from './send-adm-draft';
import { SendAdmNoOrder } from './send-adm-no-order';
import { SendAdmSent } from './send-adm-sent';
import { useRefreshSendState } from './send-adm.api';
import { useSendState } from './use-send-state';
import './send-adm.m1.css';


function useTitle(ym: string | undefined) {
  const { t } = useTranslation();
  return { crumbs: [t('nav.groups.monthly'), t('nav.sendAdm')], title: t('sendAdm.title', { month: ym ? monthOf(ym) : '' }).trim(), description: t('sendAdm.description') };
}

// Khung tiêu đề cho lúc chưa có số liệu hoặc kỳ chưa khóa (chưa có nút thao tác)
function Bare({ ym, children }: { ym: string | undefined; children: ReactNode }) {
  return (
    <div className="ct-page sa-page">
      <PageHeader {...useTitle(ym)} />
      {children}
    </div>
  );
}

// Chỉ điều phối chế độ: Không cần đề nghị / Đã gửi / Lập phiếu (kể cả đang làm bản mới, chỉ ở trình duyệt)
function Board({ ym }: { ym: string }) {
  const qc = useQueryClient();
  const head = useTitle(ym);
  const report = useMonthReport(ym);
  const items = useAdminItems();
  const config = useAdminConfig();
  const summary = usePeriodSummary(ym);
  const send = useSendState(ym);
  const refreshSend = useRefreshSendState(ym);
  // Một chỗ tải tệp cho cả hai chế độ: lỗi tải ngay sau khi chốt vẫn còn khi trang chuyển sang Đã gửi
  const files = useSnapshotDownload(ym);
  const [carry, setCarry] = useState<Record<string, number> | null>(null);
  const queries = [report, items, config, summary, send.query];
  if (queries.some((q) => q.isError)) return <Bare ym={ym}><LoadError onRetry={() => queries.forEach((q) => void q.refetch())} /></Bare>;
  if (!report.data || !items.data || !config.data || !summary.data || !send.query.data) return <Bare ym={ym}><Loading /></Bare>;
  if (send.noOrder) return <SendAdmNoOrder head={head} ym={ym} noOrder={send.noOrder} />;
  if (send.sent && !carry) return <SendAdmSent head={head} report={report.data} items={items.data} send={{ ...send, sent: send.sent }} files={files} onNewDraft={setCarry} />;
  // Server nói kỳ chưa tới: kỳ hiện hành trên trang đã cũ → tải lại, không có tháng nào khác để về
  const invalidPeriod = () => {
    void qc.invalidateQueries({ queryKey: currentPeriodQuery().queryKey });
    return false;
  };
  const taken = () => {
    setCarry(null);
    void refreshSend();
  };
  return (
    <SendAdmDraft
      key={carry ? 'new' : 'first'}
      head={head}
      report={report.data}
      items={items.data}
      summary={summary.data}
      boxes={config.data.signature_boxes}
      sent={carry ? send.sent : null}
      carry={carry ?? undefined}
      onBack={carry ? () => setCarry(null) : undefined}
      onTaken={taken}
      onInvalidPeriod={invalidPeriod}
      files={files}
    />
  );
}

export function SendAdmPage() {
  const current = useCurrentPeriod();
  const lockedYm = current.data ? shiftYm(current.data.ym, -1) : undefined;
  if (lockedYm) {
    return (
      <PeriodLockGate key={lockedYm} ym={lockedYm} frame={(node) => <Bare ym={lockedYm}>{node}</Bare>}>
        <Board ym={lockedYm} />
      </PeriodLockGate>
    );
  }
  return <Bare ym={undefined}>{current.isError ? <LoadError onRetry={() => void current.refetch()} /> : <Loading />}</Bare>;
}
