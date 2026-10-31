import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon } from '@/ui/icon';
import { Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { useConfirm } from '@/ui/confirm-context';
import { useCurrentPeriod, type CurrentPeriod } from '@/features/request/request.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { useMonthReport, type MonthReport, type SnapshotKind } from './reports.api';
import { ReportPart1 } from './report-part1';
import { ReportIssues } from './report-issues';
import { ReportPart2 } from './report-part2';
import { ReportSnapshots } from './report-snapshots';
import { ReportSection } from './report-section';
import { PendingDialog } from './report-pending-dialog';
import { useOrderQty } from './use-order-qty';
import { useReportsParams } from './use-reports-params';
import { useSnapshotDownload, useTakeSnapshot } from './use-snapshot';
import './reports.m1.css';

function ReportsHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation();
  const title = t('nav.reports');
  return <PageHeader crumbs={[t('nav.groups.monthly'), title]} title={title} description={t('reports.page.description')} actions={actions} />;
}

function TakeButtons({ taking, onTake }: { taking: SnapshotKind | null; onTake: (kind: SnapshotKind) => void }) {
  const { t } = useTranslation();
  const label = (kind: SnapshotKind, text: string) => (taking === kind ? t('reports.page.taking') : text);
  return (
    <>
      <button type="button" className="btn" disabled={taking !== null} onClick={() => onTake('xlsx')}>
        <Icon name="sheet" size={18} />
        {label('xlsx', t('reports.page.exportXlsx'))}
      </button>
      <button type="button" className="btn btn--primary" disabled={taking !== null} onClick={() => onTake('print')}>
        <Icon name="printer" size={18} />
        {label('print', t('reports.page.print'))}
      </button>
    </>
  );
}

function MonthRow({ ym, period, onChange }: { ym: string; period: CurrentPeriod; onChange: (ym: string) => void }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  // Kỳ đang mở thì số còn đổi tới hạn; kỳ trước đó đã khóa
  const status =
    ym === period.ym
      ? { tone: 'ok' as const, label: t('reports.page.status.open', { day: fmt.lastDay(period.deadline) }) }
      : { tone: 'dark' as const, label: t('reports.page.status.locked') };
  return (
    <div className="bc-month">
      <MonthSwitcher
        value={ym}
        max={period.ym}
        onChange={onChange}
        status={status}
        formatLabel={(v) => t('reports.page.month', { month: monthOf(v), year: v.slice(0, 4) })}
        labels={{ group: t('reports.page.monthNav'), prev: t('reports.page.prevMonth'), next: t('reports.page.nextMonth') }}
      />
    </div>
  );
}

function HowToNeed() {
  const { t } = useTranslation();
  return (
    <ReportSection title={t('reports.page.how.title')}>
      <p className="bc-how">{t('reports.page.how.formula')}</p>
      <p className="bc-how">{t('reports.page.how.order')}</p>
    </ReportSection>
  );
}

function ReportBody({ report, period, onMonth, onInvalidPeriod }: { report: MonthReport; period: CurrentPeriod; onMonth: (ym: string) => void; onInvalidPeriod: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const qty = useOrderQty(report);
  const files = useSnapshotDownload(report.ym);
  const snap = useTakeSnapshot(report, qty, files, onInvalidPeriod);
  const month = monthOf(report.ym);
  // Nháp Đặt mua thuộc về một kỳ: rời kỳ thì hỏi rồi bỏ (component dựng lại theo ym)
  const changeMonth = async (ym: string) => {
    if (qty.editedCount > 0) {
      const ok = await confirm({
        title: t('reports.page.leaveConfirm.title'),
        message: t('reports.page.leaveConfirm.message', { count: qty.editedCount, month }),
        confirmLabel: t('reports.page.leaveConfirm.ok'),
        cancelLabel: t('reports.page.leaveConfirm.cancel'),
        danger: true,
      });
      if (!ok) return;
    }
    onMonth(ym);
  };
  return (
    <div className="bc-page">
      <ReportsHeader actions={<TakeButtons taking={snap.taking} onTake={snap.take} />} />
      <MonthRow ym={report.ym} period={period} onChange={(v) => void changeMonth(v)} />
      {report.ym === period.ym && <p className="alert">{t('reports.page.openNotice', { month })}</p>}
      {report.pending_custom_count > 0 && (
        <p className="alert alert--warn">
          {t('reports.page.pendingNotice', { count: report.pending_custom_count })}{' '}
          <Link to={`/admin/review?ym=${report.ym}`}>{t('reports.page.pendingLink')}</Link>
        </p>
      )}
      {snap.fixCount > 0 && <p role="alert" className="alert alert--danger">{t('reports.page.fixErrors', { count: snap.fixCount })}</p>}
      {snap.notice && <p role="alert" className="alert alert--danger">{t(`reports.page.error.${snap.notice}`)}</p>}
      <ReportPart1 report={report} qty={qty} />
      <ReportIssues issues={report.issues} />
      <ReportPart2 departments={report.byDepartment} />
      <ReportSnapshots ym={report.ym} fresh={snap.fresh} files={files} />
      <HowToNeed />
      {snap.asking && <PendingDialog count={report.pending_custom_count} onReview={snap.review} onConfirm={snap.confirm} onCancel={snap.cancel} />}
    </div>
  );
}

function ReportForMonth({ ym, period, onMonth, onInvalidPeriod }: { ym: string; period: CurrentPeriod; onMonth: (ym: string) => void; onInvalidPeriod: () => void }) {
  const query = useMonthReport(ym);
  if (query.data) return <ReportBody report={query.data} period={period} onMonth={onMonth} onInvalidPeriod={onInvalidPeriod} />;
  return (
    <div className="bc-page">
      <ReportsHeader />
      {query.isError ? <LoadError onRetry={() => void query.refetch()} /> : <Loading />}
    </div>
  );
}

export function ReportsPage() {
  const current = useCurrentPeriod();
  const p = useReportsParams(current.data?.ym);
  if (!p.ym || !current.data) {
    return (
      <div className="bc-page">
        <ReportsHeader />
        {current.isError ? <LoadError onRetry={() => void current.refetch()} /> : <Loading />}
      </div>
    );
  }
  return <ReportForMonth key={p.ym} ym={p.ym} period={current.data} onMonth={p.setMonth} onInvalidPeriod={p.resetMonth} />;
}
