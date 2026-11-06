import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { Toolbar } from '@/ui/toolbar';
import { shiftYm } from '@/lib/ym';
import { useCurrentPeriod, type CurrentPeriod } from '@/features/request/request.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { useSendState } from '@/features/send-adm/use-send-state';
import type { SentSnapshot } from '@/features/send-adm/send-adm.api';
import { useMonthReport, type MonthReport } from './reports.api';
import { ReportPart1 } from './report-part1';
import { ReportIssues } from './report-issues';
import { ReportPart2 } from './report-part2';
import { ReportSnapshots } from './report-snapshots';
import { useReportsParams } from './use-reports-params';
import { useSnapshotDownload } from './use-snapshot';
import './reports.m1.css';

function ReportsHeader() {
  const { t } = useTranslation();
  const title = t('nav.reports');
  return <PageHeader crumbs={[t('nav.groups.monthly'), title]} title={title} description={t('reports.page.description')} />;
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
    <MonthSwitcher
      value={ym}
      max={period.ym}
      onChange={onChange}
      status={status}
      formatLabel={(v) => t('reports.page.month', { month: monthOf(v), year: v.slice(0, 4) })}
      labels={{ group: t('reports.page.monthNav'), prev: t('reports.page.prevMonth'), next: t('reports.page.nextMonth') }}
    />
  );
}

interface BodyProps {
  report: MonthReport;
  sent: SentSnapshot | null;
  period: CurrentPeriod;
  onMonth: (ym: string) => void;
}

function ReportBody({ report, sent, period, onMonth }: BodyProps) {
  const { t } = useTranslation();
  const files = useSnapshotDownload(report.ym);
  const open = report.ym === period.ym;
  return (
    <div className="ct-page bc-page">
      <ReportsHeader />
      <Toolbar lead={<MonthRow ym={report.ym} period={period} onChange={onMonth} />} />
      {open && <p className="alert">{t('reports.page.openNotice', { month: monthOf(report.ym) })}</p>}
      {report.pending_custom_count > 0 && (
        <p className="alert alert--warn">
          {t('reports.page.pendingNotice', { count: report.pending_custom_count })}{' '}
          <Link to={`/admin/review?ym=${report.ym}`}>{t('reports.page.pendingLink')}</Link>
        </p>
      )}
      <ReportPart1 report={report} sent={sent} editable={report.ym === shiftYm(period.ym, -1)} />
      <ReportIssues issues={report.issues} />
      <ReportPart2 departments={report.byDepartment} />
      <ReportSnapshots ym={report.ym} files={files} />
    </div>
  );
}

// Kỳ đã khóa: Đề nghị theo bản có hàng mới nhất nếu có; kỳ đang mở chưa gửi được nên không hỏi server
function ReportForMonth({ ym, period, onMonth }: { ym: string; period: CurrentPeriod; onMonth: (ym: string) => void }) {
  const locked = ym < period.ym;
  const query = useMonthReport(ym);
  const send = useSendState(ym, locked);
  const failed = [query, send.query].filter((q) => q.isError);
  if (query.data && (!locked || send.query.data)) return <ReportBody report={query.data} sent={send.sent} period={period} onMonth={onMonth} />;
  return (
    <div className="ct-page bc-page">
      <ReportsHeader />
      {failed.length > 0 ? <LoadError onRetry={() => void Promise.all(failed.map((q) => q.refetch()))} /> : <Loading />}
    </div>
  );
}

export function ReportsPage() {
  const current = useCurrentPeriod();
  const p = useReportsParams(current.data?.ym);
  if (!p.ym || !current.data) {
    return (
      <div className="ct-page bc-page">
        <ReportsHeader />
        {current.isError ? <LoadError onRetry={() => void current.refetch()} /> : <Loading />}
      </div>
    );
  }
  return <ReportForMonth key={p.ym} ym={p.ym} period={current.data} onMonth={p.setMonth} />;
}
