import { useId, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { YM, shiftYm } from '@/lib/ym';
import { useConfirm } from '@/ui/confirm-context';
import { Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { useMonthReport, type MonthReport, type SnapshotKind } from './reports.api';
import { ReportItemTable } from './report-item-table';
import { IssuesTable } from './issues-table';
import { ReportDetailTable } from './report-detail-table';
import { SnapshotList } from './snapshot-list';
import { useOrderQty } from './use-order-qty';
import { useTakeSnapshot } from './use-take-snapshot';
import '@/features/admin/admin.css';
import './reports.css';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="a-panel rp-section" aria-labelledby={id}>
      <h2 id={id} className="rp-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ReportHead({ ym, openYm, disabled, onMonth, onTake }: {
  ym: string;
  openYm: string;
  disabled: boolean;
  onMonth: (ym: string) => void;
  onTake: (kind: SnapshotKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="a-toolbar rp-head">
      <MonthSwitcher
        value={ym}
        max={openYm}
        onChange={onMonth}
        formatLabel={(v) => t('reports.month', { month: monthOf(v), year: v.slice(0, 4) })}
        labels={{ group: t('reports.monthNav'), prev: t('reports.prevMonth'), next: t('reports.nextMonth') }}
      />
      <span className="sp" />
      <button type="button" className="btn btn--sm" disabled={disabled} onClick={() => onTake('xlsx')}>
        {t('reports.exportXlsx')}
      </button>
      <button type="button" className="btn btn--sm btn--primary" disabled={disabled} onClick={() => onTake('print')}>
        {t('reports.print')}
      </button>
    </div>
  );
}

function ReportBody({ report, openYm, onMonth }: { report: MonthReport; openYm: string; onMonth: (ym: string) => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const qty = useOrderQty(report);
  const snap = useTakeSnapshot(report, qty);
  const busy = snap.pending || qty.invalid;
  // Nháp Đặt mua thuộc về một kỳ: rời kỳ thì hỏi rồi bỏ (component remount theo ym)
  const changeMonth = async (ym: string) => {
    if (qty.dirty) {
      const ok = await confirm({
        title: t('reports.leaveConfirm.title'),
        message: t('reports.leaveConfirm.message'),
        confirmLabel: t('reports.leaveConfirm.ok'),
        cancelLabel: t('reports.leaveConfirm.cancel'),
      });
      if (!ok) return;
    }
    onMonth(ym);
  };
  return (
    <div className="a-stack">
      <ReportHead ym={report.ym} openYm={openYm} disabled={busy} onMonth={(v) => void changeMonth(v)} onTake={(kind) => void snap.take(kind)} />
      {snap.notice && (
        <p role="alert" className="alert alert--warn">
          {t(`reports.error.${snap.notice}`)}
        </p>
      )}
      <Section title={t('reports.items.title')}>
        <ReportItemTable report={report} qty={qty} />
        <IssuesTable issues={report.issues} />
      </Section>
      <Section title={t('reports.detail.title')}>
        <ReportDetailTable departments={report.byDepartment} />
      </Section>
      <SnapshotList ym={report.ym} />
    </div>
  );
}

function ReportForMonth({ ym, openYm, onMonth }: { ym: string; openYm: string; onMonth: (ym: string) => void }) {
  const query = useMonthReport(ym);
  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  if (!query.data) return <Loading />;
  return <ReportBody report={query.data} openYm={openYm} onMonth={onMonth} />;
}

// Mặc định kỳ khóa gần nhất (tháng trước kỳ đang mở); xem được tới kỳ đang mở
export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const current = useCurrentPeriod();
  const openYm = current.data?.ym;
  const asked = params.get('ym');
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : openYm && shiftYm(openYm, -1);

  if (current.isError) return <LoadError onRetry={() => void current.refetch()} />;
  if (!ym || !openYm) return <Loading />;
  return <ReportForMonth key={ym} ym={ym} openYm={openYm} onMonth={(v) => setParams({ ym: v })} />;
}
