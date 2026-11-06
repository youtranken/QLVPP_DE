import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { defaultOrder } from '@/lib/report-qty';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useConfirm } from '@/ui/confirm-context';
import { Icon } from '@/ui/icon';
import { PageHeader } from '@/ui/page-header';
import type { AdminItem } from '@/features/catalog/catalog.api';
import type { SignatureBox } from '@/features/admin/admin.api';
import { useLeaveGuard } from '@/features/request/use-leave-guard';
import { useUnitNames } from '@/features/units/units.api';
import type { MonthReport, SnapshotKind } from '@/features/reports/reports.api';
import { ReportSnapshots } from '@/features/reports/report-snapshots';
import { useOrderQty, type OrderQty } from '@/features/reports/use-order-qty';
import { useSnapshotDownload, useTakeSnapshot } from '@/features/reports/use-snapshot';
import type { PeriodSummary } from '@/features/summary/summary.api';
import { SendAdmChecklist } from './send-adm-checklist';
import { PrintConfirm } from './send-adm-dialogs';
import { useLeavePrompt, useNoOrderConfirm } from './use-send-adm-confirms';
import { SendAdmOrders } from './send-adm-orders';
import { PreviewButton, type PreviewRow } from './request-form-preview';
import { orderChanges, orderOf, toOrderRows, type OrderRow } from './send-adm-rows';
import { markNoOrder, useAdmOwedMonths, useRefreshSendState, type SentSnapshot } from './send-adm.api';

export interface DraftProps {
  head: { crumbs: string[]; title: string; description: string };
  report: MonthReport;
  items: AdminItem[];
  summary: PeriodSummary;
  boxes: SignatureBox[];
  // Đang làm bản mới: bản đã gửi để so số; null khi kỳ chưa gửi
  sent: SentSnapshot | null;
  carry?: Record<string, number>;
  onBack?: () => void;
  onTaken: () => void;
  onInvalidPeriod: () => boolean;
}

function ActionButton({ mode: kind, disabled, taking, onTake }: { mode: SnapshotKind; disabled: boolean; taking: SnapshotKind | null; onTake: (kind: SnapshotKind) => void }) {
  const { t } = useTranslation();
  const xlsx = kind === 'xlsx';
  return (
    <button type="button" className={xlsx ? 'btn' : 'btn btn--primary'} disabled={disabled} aria-busy={taking === kind || undefined} onClick={() => onTake(kind)}>
      <Icon name={xlsx ? 'sheet' : 'printer'} size={18} />
      {taking === kind ? t('reports.page.taking') : t(xlsx ? 'sendAdm.actions.xlsx' : 'sendAdm.actions.print')}
    </button>
  );
}

function useNoOrder(ym: string, qty: OrderQty) {
  const { csrfToken } = useMe();
  const ask = useNoOrderConfirm();
  const refresh = useRefreshSendState(ym);
  const flight = useSingleFlight();
  const [failed, setFailed] = useState(false);
  const run = () =>
    flight.run(async () => {
      if (!(await ask())) return;
      setFailed(false);
      try {
        await markNoOrder(ym, qty.edited, csrfToken);
      } catch {
        setFailed(true);
      }
      await refresh();
    });
  return { run, pending: flight.pending, failed };
}

// Sau khi chốt thành công, số đang có thành mốc: rời trang không hỏi nữa cho tới khi sửa tiếp
function useDirtyCount(qty: OrderQty, fresh: ReadonlySet<string>) {
  const sig = `${JSON.stringify(qty.edited)}|${qty.errorCount}`;
  const sentSig = useRef(sig);
  const [exported, setExported] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);
  if (fresh.size !== seen) {
    setSeen(fresh.size);
    setExported(sentSig.current);
  }
  return { count: sig === exported ? 0 : qty.editedCount, mark: () => (sentSig.current = sig) };
}

function useDraftRows(report: MonthReport, items: AdminItem[]) {
  const owed = report.byItem.some((r) => (r.adm_owed ?? 0) > 0) || report.custom.some((r) => (r.adm_owed ?? 0) > 0);
  const admMonths = useAdmOwedMonths(report.ym, owed);
  return useMemo(() => toOrderRows(report, items, { progress: report.progress, admMonths }), [report, items, admMonths]);
}

function previewRows(rows: OrderRow[], qty: OrderQty, unitName: ReturnType<typeof useUnitNames>): PreviewRow[] {
  return rows
    .map((r) => ({ key: r.key, code: r.code, name: r.name, name_en: r.name_en, unit: unitName(r.unit, 'vi'), qty: orderOf(qty, r) }))
    .filter((r) => r.qty > 0);
}

export function SendAdmDraft({ head, report, items, summary, boxes, sent, carry, onBack, onTaken, onInvalidPeriod }: DraftProps) {
  const { t } = useTranslation();
  const ask = useConfirm();
  const unitName = useUnitNames();
  const qty = useOrderQty(report, { baseOf: defaultOrder, initial: carry });
  const rows = useDraftRows(report, items);
  const changes = sent ? orderChanges(rows, (r) => orderOf(qty, r), sent.data) : [];
  const files = useSnapshotDownload(report.ym);
  const snap = useTakeSnapshot(report, qty, files, onInvalidPeriod, { reuse: true, mustConfirm: report.pending_custom_count > 0 || changes.length > 0, onTaken });
  const noOrder = useNoOrder(report.ym, qty);
  const formRows = previewRows(rows, qty, unitName);
  const empty = formRows.length === 0;
  const blocked = qty.errorCount > 0 || snap.taking !== null || empty;
  const dirty = useDirtyCount(qty, snap.fresh);
  const prompt = useLeavePrompt(qty.editedCount);
  useLeaveGuard(dirty.count, prompt);
  const take = (kind: SnapshotKind) => {
    dirty.mark();
    snap.take(kind);
  };
  const back = async () => {
    if (dirty.count === 0 || (await ask(prompt))) onBack?.();
  };
  return (
    <div className="ct-page sa-page">
      <PageHeader {...head} secondary={<ActionButton mode="xlsx" disabled={blocked} taking={snap.taking} onTake={take} />} primary={<ActionButton mode="print" disabled={blocked} taking={snap.taking} onTake={take} />} />
      {empty && !sent ? (
        <div className="sa-row">
          <button type="button" className="btn" disabled={noOrder.pending} onClick={() => void noOrder.run()}>
            {t('sendAdm.noOrder.action')}
          </button>
        </div>
      ) : (
        empty && <p className="alert alert--warn">{t('warn.W9')}</p>
      )}
      {noOrder.failed && <p role="alert" className="alert alert--danger">{t('sendAdm.noOrder.failed')}</p>}
      {snap.notice && <p role="alert" className="alert alert--danger">{t(`reports.page.error.${snap.notice}`)}</p>}
      <div className="sa-row">
        {onBack && (
          <button type="button" className="btn btn--ghost" onClick={() => void back()}>
            <Icon name="back" size={18} />
            {t('sendAdm.draft.back')}
          </button>
        )}
        <PreviewButton rows={formRows} signatureBoxes={boxes} ym={report.ym} />
      </div>
      <SendAdmChecklist ym={report.ym} summary={summary} />
      <SendAdmOrders rows={rows} qty={qty} />
      <ReportSnapshots ym={report.ym} fresh={snap.fresh} files={files} />
      {snap.asking && <PrintConfirm kind={snap.asking} ym={report.ym} pending={report.pending_custom_count} changes={changes} sentAt={sent?.created_at ?? null} onConfirm={snap.confirm} onCancel={snap.cancel} />}
    </div>
  );
}
