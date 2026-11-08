import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { Toolbar } from '@/ui/toolbar';
import { lockedYm } from '@/lib/ym';
import { useUnlockedSentence } from '@/features/summary/use-unlocked-sentence';
import { useCurrentPeriod, type CurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
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

// Trang in riêng mở từ đây thì Quay lại về đây
const SNAPSHOTS_FROM = 'reports' as const;

function ReportsHeader() {
  const { t } = useTranslation();
  const title = t('nav.reports');
  return <PageHeader crumbs={[t('nav.groups.monthly'), title]} title={title} description={t('reports.page.description')} />;
}

function MonthRow({ ym, period, onChange }: { ym: string; period: CurrentPeriod; onChange: (ym: string) => void }) {
  const { t } = useTranslation();
  return (
    <MonthSwitcher
      value={ym}
      max={lockedYm(period.ym)}
      onChange={onChange}
      status={{ tone: 'dark', label: t('reports.page.status.locked') }}
      beyond={{ ym: period.ym, label: t('summary.page.open') }}
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
  return (
    <div className="ct-page bc-page">
      <ReportsHeader />
      <Toolbar lead={<MonthRow ym={report.ym} period={period} onChange={onMonth} />} />
      {report.pending_custom_count > 0 && (
        <p className="alert alert--warn">
          {t('reports.page.pendingNotice', { count: report.pending_custom_count })}{' '}
          <Link to={`/admin/review?ym=${report.ym}`}>{t('reports.page.pendingLink')}</Link>
        </p>
      )}
      <ReportPart1 report={report} sent={sent} editable={report.ym === lockedYm(period.ym)} />
      <ReportIssues issues={report.issues} />
      <ReportPart2 departments={report.byDepartment} />
      <ReportSnapshots ym={report.ym} files={files} from={SNAPSHOTS_FROM} />
    </div>
  );
}

// Đề nghị theo bản có hàng mới nhất nếu có; server vẫn từ chối kỳ chưa khóa (409) thì nói khi nào xem được
function ReportForMonth({ ym, period, onMonth }: { ym: string; period: CurrentPeriod; onMonth: (ym: string) => void }) {
  const query = useMonthReport(ym);
  const send = useSendState(ym);
  const unlocked = useUnlockedSentence(ym);
  const failed = [query, send.query].filter((q) => q.isError);
  if (query.data && send.query.data) return <ReportBody report={query.data} sent={send.sent} period={period} onMonth={onMonth} />;
  const notLocked = failed.find((q) => apiErrorCode(q.error) === 'PERIOD_NOT_LOCKED');
  return (
    <div className="ct-page bc-page">
      <ReportsHeader />
      {notLocked ? (
        <EmptyState title={unlocked(apiErrorString(notLocked.error, 'deadline') ?? period.deadline)} />
      ) : failed.length > 0 ? (
        <LoadError onRetry={() => void Promise.all(failed.map((q) => q.refetch()))} />
      ) : (
        <Loading />
      )}
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
