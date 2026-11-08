import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { defaultOrder } from '@/lib/report-qty';
import { lockedYm } from '@/lib/ym';
import { Icon } from '@/ui/icon';
import { Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { currentPeriodQuery, useCurrentPeriod, type CurrentPeriod } from '@/features/request/request.api';
import { useLeaveGuard } from '@/features/request/use-leave-guard';
import { monthOf } from '@/features/request/request-format';
import { PrintConfirm } from '@/features/send-adm/send-adm-dialogs';
import { orderChanges, orderOf, toOrderRows } from '@/features/send-adm/send-adm-rows';
import { useRegistrants } from '@/features/send-adm/use-registrants';
import { useLeavePrompt } from '@/features/send-adm/use-send-adm-confirms';
import { useSendState } from '@/features/send-adm/use-send-state';
import { PeriodLockGate } from '@/features/summary/period-lock-gate';
import { PrintNote } from '@/features/send-adm/send-adm-print-note';
import { ItemPeopleDialog } from './item-people-dialog';
import { ReportItemTable, type ItemTableRow } from './report-item-table';
import { part1Rows } from './report-part1-rows';
import { ReportSnapshots } from './report-snapshots';
import { ReportStatusLine } from './report-status-line';
import { useMonthReport, type MonthReport, type SnapshotKind } from './reports.api';
import { useOrderQty } from './use-order-qty';
import { usePrintInPlace } from './use-print-in-place';
import { useChangedKeys, useDirtyCount, useNoOrder, initialFromSent } from './use-report-send';
import { useReportsParams } from './use-reports-params';
import { useSnapshotDownload, useTakeSnapshot } from './use-snapshot';
import '@/features/send-adm/send-adm.m1.css';
import './reports.m1.css';

function Heading({ ym, openYm, onMonth, children }: { ym: string; openYm: string; onMonth: (ym: string) => void; children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="bc-head">
      <h1>{t('reports.send.title')}</h1>
      <MonthSwitcher
        value={ym}
        max={lockedYm(openYm)}
        onChange={onMonth}
        beyond={{ ym: openYm, label: t('summary.page.open') }}
        formatLabel={(v) => t('reports.page.month', { month: monthOf(v), year: v.slice(0, 4) })}
        labels={{ group: t('reports.page.monthNav'), prev: t('reports.page.prevMonth'), next: t('reports.page.nextMonth') }}
      />
      {children}
    </div>
  );
}

function ActionButton({ xlsx, disabled, taking, onTake }: { xlsx: boolean; disabled: boolean; taking: SnapshotKind | null; onTake: (xlsx: boolean) => void }) {
  const { t } = useTranslation();
  const busy = taking === (xlsx ? 'xlsx' : 'print');
  const label = xlsx ? (busy ? 'reports.page.taking' : 'reports.send.excel') : busy ? 'reports.page.preparingPrint' : 'sendAdm.actions.print';
  return (
    <button type="button" className={xlsx ? 'btn' : 'btn btn--primary'} disabled={disabled} aria-busy={busy || undefined} onClick={() => onTake(xlsx)}>
      {busy && !xlsx ? <span className="spinner sa-spinner" aria-hidden="true" /> : <Icon name={xlsx ? 'sheet' : 'printer'} size={18} />}
      {t(label)}
    </button>
  );
}

interface BodyProps {
  report: MonthReport;
  openYm: string;
  editable: boolean;
  onMonth: (ym: string) => void;
  printer: ReturnType<typeof usePrintInPlace>;
}

function ReportSendBody({ report, openYm, editable, onMonth, printer }: BodyProps) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const send = useSendState(report.ym);
  const items = useAdminItems();
  const cats = useAllCategories();
  const files = useSnapshotDownload(report.ym);
  const people = useRegistrants(report.ym);
  const sent = send.sent;
  const qty = useOrderQty(report, { baseOf: defaultOrder, initial: editable ? initialFromSent(sent?.data) : undefined });
  const changed = useChangedKeys(report, editable ? sent : null, send.deliveredSince);
  const [onlyNeed, setOnlyNeed] = useState(false);
  const [whoKey, setWhoKey] = useState<string | null>(null);
  const settled = !items.isPending && !cats.isPending;
  const source = editable ? report : (sent?.data ?? report);
  const orderRows = useMemo(() => (settled ? toOrderRows(source, items.data ?? [], { progress: report.progress }) : []), [settled, source, items.data, report.progress]);
  const tableRows = useMemo<ItemTableRow[]>(() => {
    if (!settled) return [];
    const byKey = new Map(orderRows.map((r) => [r.key, r]));
    return part1Rows(source, items.data, cats.data, { progress: report.progress, sent: editable ? null : (sent?.data ?? null) }).map((r) => {
      const o = byKey.get(r.id);
      return { ...r, order: editable && o ? orderOf(qty, o) : r.n.order, changed: changed.has(r.id) };
    });
  }, [settled, source, items.data, cats.data, report.progress, editable, sent, orderRows, qty, changed]);
  const invalidPeriod = () => {
    void qc.invalidateQueries({ queryKey: currentPeriodQuery().queryKey });
    return false;
  };
  const changes = editable && sent ? orderChanges(orderRows, (r) => orderOf(qty, r), sent.data) : [];
  const snap = useTakeSnapshot(report, qty, files, invalidPeriod, {
    reuse: true,
    mustConfirm: report.pending_custom_count > 0 || changes.length > 0,
    onTaken: () => void qc.invalidateQueries({ queryKey: ['send-state'] }),
    print: printer.print,
  });
  const noOrder = useNoOrder(report.ym, qty);
  const dirty = useDirtyCount(qty, snap.fresh);
  useLeaveGuard(dirty.count, useLeavePrompt(dirty.count));
  const empty = orderRows.length > 0 && orderRows.every((r) => orderOf(qty, r) === 0);
  const blocked = qty.errorCount > 0 || snap.taking !== null || empty || !settled;
  const take = (xlsx: boolean) => {
    dirty.mark();
    snap.take(xlsx ? 'xlsx' : 'print');
  };
  const visible = onlyNeed ? tableRows.filter((r) => r.n.want > 0) : tableRows;
  const openSent = (xlsx: boolean) => (sent ? (xlsx ? void files.run(sent.id) : void printer.print(sent.data)) : undefined);
  const actions = editable ? (
    <>
      <ActionButton xlsx disabled={blocked} taking={snap.taking} onTake={take} />
      <ActionButton xlsx={false} disabled={blocked} taking={snap.taking} onTake={take} />
    </>
  ) : (
    <>
      <ActionButton xlsx disabled={!sent || files.pending} taking={null} onTake={openSent} />
      <ActionButton xlsx={false} disabled={!sent || printer.pending} taking={null} onTake={openSent} />
    </>
  );
  const retry = () => [items, cats].forEach((q) => q.isError && void q.refetch());
  return (
    <div className="bc-page">
      <Heading ym={report.ym} openYm={openYm} onMonth={onMonth}>
        <label className="bc-switch">
          <input type="checkbox" checked={onlyNeed} onChange={(e) => setOnlyNeed(e.target.checked)} />
          {t('reports.part1.onlyNeed')}
        </label>
        <div className="bc-head__actions">{actions}</div>
      </Heading>
      <ReportStatusLine send={send} rowsChanged={changed.size} pendingCustom={report.pending_custom_count} ym={report.ym} onReprint={sent ? () => void printer.print(sent.data) : undefined} reprinting={printer.pending} />
      {!empty && <PrintNote />}
      {empty && editable && send.state !== 'sent' && send.state !== 'no_order' && (
        <p className="bc-row">
          <button type="button" className="btn" disabled={noOrder.pending} onClick={() => void noOrder.run()}>
            {t('sendAdm.noOrder.action')}
          </button>
        </p>
      )}
      {noOrder.failed && <p role="alert" className="alert alert--danger">{i18n.exists(`common.errors.${noOrder.failed}`) ? t(`common.errors.${noOrder.failed}`) : t('sendAdm.noOrder.failed')}</p>}
      {snap.notice && <p role="alert" className="alert alert--danger">{t(`reports.page.error.${snap.notice}`)}</p>}
      {(items.isError || cats.isError) && (
        <p className="alert alert--warn bc-inline-notice">
          {t('reports.part1.groupsFailed')}
          <button type="button" className="btn btn--sm" onClick={retry}>{t('reports.part1.retry')}</button>
        </p>
      )}
      <ReportItemTable
        rows={visible}
        cats={cats.data ?? []}
        loading={!settled}
        empty={t(onlyNeed ? 'reports.part1.emptyNeed' : 'reports.part1.empty')}
        editable={editable}
        value={qty.value}
        hasError={qty.hasError}
        onEdit={qty.set}
        people={people}
        onPeople={setWhoKey}
      />
      <ReportSnapshots ym={report.ym} files={files} />
      {whoKey && <ItemPeopleDialog ym={report.ym} itemKey={whoKey} order={tableRows.find((r) => r.id === whoKey)?.order ?? 0} onClose={() => setWhoKey(null)} />}
      {snap.asking && <PrintConfirm kind={snap.asking} ym={report.ym} pending={report.pending_custom_count} changes={changes} sentAt={sent?.created_at ?? null} onConfirm={snap.confirm} onCancel={snap.cancel} />}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="ct-page bc-page">
      <PageHeader crumbs={[t('nav.groups.monthly'), t('reports.send.title')]} title={t('reports.send.title')} />
      {children}
    </div>
  );
}

function ReportForMonth({ ym, period, onMonth }: { ym: string; period: CurrentPeriod; onMonth: (ym: string) => void }) {
  const query = useMonthReport(ym);
  const send = useSendState(ym);
  const printer = usePrintInPlace();
  const frame = useCallback((node: React.ReactNode) => <Frame>{node}</Frame>, []);
  const failed = [query, send.query].filter((q) => q.isError);
  return (
    <PeriodLockGate ym={ym} frame={frame}>
      {query.data && send.query.data ? (
        <>
          <ReportSendBody report={query.data} openYm={period.ym} editable={ym === lockedYm(period.ym)} onMonth={onMonth} printer={printer} />
          {printer.portal}
        </>
      ) : failed.length > 0 ? (
        <Frame><LoadError onRetry={() => void Promise.all(failed.map((q) => q.refetch()))} /></Frame>
      ) : (
        <Frame><Loading /></Frame>
      )}
    </PeriodLockGate>
  );
}

export function ReportSendPage() {
  const current = useCurrentPeriod();
  const p = useReportsParams(current.data?.ym);
  if (!p.ym || !current.data) return <Frame>{current.isError ? <LoadError onRetry={() => void current.refetch()} /> : <Loading />}</Frame>;
  return <ReportForMonth key={p.ym} ym={p.ym} period={current.data} onMonth={p.setMonth} />;
}
