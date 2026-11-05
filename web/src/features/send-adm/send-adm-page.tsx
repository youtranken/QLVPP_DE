import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { vnLockDate } from '@/lib/format-time';
import { shiftYm } from '@/lib/ym';
import { Icon } from '@/ui/icon';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { useAdminConfig } from '@/features/admin/admin.api';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { currentPeriodQuery, useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { useUnitNames } from '@/features/units/units.api';
import { PendingDialog } from '@/features/reports/report-pending-dialog';
import { useMonthReport, type MonthReport, type SnapshotKind } from '@/features/reports/reports.api';
import { ReportSnapshots } from '@/features/reports/report-snapshots';
import { useOrderQty } from '@/features/reports/use-order-qty';
import { useSnapshotDownload, useTakeSnapshot } from '@/features/reports/use-snapshot';
import { usePeriodSummary, type PeriodSummary } from '@/features/summary/summary.api';
import { SendAdmChecklist } from './send-adm-checklist';
import { SendAdmOrders } from './send-adm-orders';
import { RequestFormPreview, type PreviewRow } from './request-form-preview';
import { orderOf, toOrderRows } from './send-adm-rows';
import type { AdminItem } from '@/features/catalog/catalog.api';
import type { SignatureBox } from '@/features/admin/admin.api';
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

function ActionButton({ mode: kind, disabled, taking, onTake }: { mode: SnapshotKind; disabled: boolean; taking: SnapshotKind | null; onTake: (kind: SnapshotKind) => void }) {
  const { t } = useTranslation();
  const xlsx = kind === 'xlsx';
  return (
    <button type="button" className={xlsx ? 'btn' : 'btn btn--primary'} disabled={disabled} onClick={() => onTake(kind)}>
      <Icon name={xlsx ? 'sheet' : 'printer'} size={18} />
      {taking === kind ? t('reports.page.taking') : t(xlsx ? 'sendAdm.actions.xlsx' : 'sendAdm.actions.print')}
    </button>
  );
}

interface ReadyProps {
  report: MonthReport;
  items: AdminItem[];
  summary: PeriodSummary;
  boxes: SignatureBox[];
  onInvalidPeriod: () => boolean;
}

function Ready({ report, items, summary, boxes, onInvalidPeriod }: ReadyProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const unitName = useUnitNames();
  const head = useTitle(report.ym);
  const qty = useOrderQty(report);
  const files = useSnapshotDownload(report.ym);
  const snap = useTakeSnapshot(report, qty, files, onInvalidPeriod);
  const rows = useMemo(() => toOrderRows(report, items), [report, items]);
  const formRows: PreviewRow[] = rows
    .map((r) => ({ key: r.key, code: r.code, name: r.name, name_en: r.name_en, unit: unitName(r.unit, 'vi'), qty: orderOf(qty, r) }))
    .filter((r) => r.qty > 0);
  // Ô lỗi (kể cả để trống) khóa cả hai nút: không chốt phiếu có số chưa hợp lệ
  const blocked = qty.errorCount > 0 || snap.taking !== null;
  return (
    <div className="ct-page sa-page">
      <PageHeader
        {...head}
        secondary={<ActionButton mode="xlsx" disabled={blocked} taking={snap.taking} onTake={snap.take} />}
        primary={<ActionButton mode="print" disabled={blocked} taking={snap.taking} onTake={snap.take} />}
      />
      {snap.notice && <p role="alert" className="alert alert--danger">{t(`reports.page.error.${snap.notice}`)}</p>}
      <div className="sa-grid">
        <div className="sa-left">
          <SendAdmChecklist ym={report.ym} summary={summary} />
          <SendAdmOrders rows={rows} qty={qty} />
        </div>
        <RequestFormPreview rows={formRows} signatureBoxes={boxes} ym={report.ym} />
      </div>
      <ReportSnapshots ym={report.ym} fresh={snap.fresh} files={files} />
      {snap.asking && <PendingDialog count={report.pending_custom_count} onReview={() => navigate(`/admin/review?status=pending&ym=${report.ym}`)} onConfirm={snap.confirm} onCancel={snap.cancel} />}
    </div>
  );
}

function Board({ ym }: { ym: string }) {
  const qc = useQueryClient();
  const report = useMonthReport(ym);
  const items = useAdminItems();
  const config = useAdminConfig();
  const summary = usePeriodSummary(ym);
  const queries = [report, items, config, summary];
  if (queries.some((q) => q.isError)) return <Bare ym={ym}><LoadError onRetry={() => queries.forEach((q) => void q.refetch())} /></Bare>;
  if (!report.data || !items.data || !config.data || !summary.data) return <Bare ym={ym}><Loading /></Bare>;
  // Server nói kỳ chưa tới: kỳ hiện hành trên trang đã cũ → tải lại, không có tháng nào khác để về
  const invalidPeriod = () => {
    void qc.invalidateQueries({ queryKey: currentPeriodQuery().queryKey });
    return false;
  };
  return <Ready report={report.data} items={items.data} summary={summary.data} boxes={config.data.signature_boxes} onInvalidPeriod={invalidPeriod} />;
}

function Gate({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const summary = usePeriodSummary(ym);
  const month = monthOf(ym);
  if (summary.isError) return <Bare ym={ym}><LoadError onRetry={() => void summary.refetch()} /></Bare>;
  if (!summary.data) return <Bare ym={ym}><Loading /></Bare>;
  const deadline = summary.data.deadline;
  // Chưa tới hạn thì kỳ chưa khóa: số Cần mua còn đổi theo đăng ký, không chốt phiếu
  if (deadline && new Date(deadline).getTime() > Date.now()) return <Bare ym={ym}><EmptyState title={t('sendAdm.unlocked', { month, deadline: vnLockDate(deadline) })} /></Bare>;
  return <Board ym={ym} />;
}

export function SendAdmPage() {
  const current = useCurrentPeriod();
  const lockedYm = current.data ? shiftYm(current.data.ym, -1) : undefined;
  if (lockedYm) return <Gate key={lockedYm} ym={lockedYm} />;
  return <Bare ym={undefined}>{current.isError ? <LoadError onRetry={() => void current.refetch()} /> : <Loading />}</Bare>;
}
