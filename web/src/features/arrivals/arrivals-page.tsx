import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { shiftYm } from '@/lib/ym';
import { Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import { useAdminItems, type AdminItem } from '@/features/catalog/catalog.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { useMonthReport } from '@/features/reports/reports.api';
import { PeriodLockGate } from '@/features/summary/period-lock-gate';
import { useRefreshAfterFlow } from '@/features/delivery/people/use-refresh-after-flow';
import { postReceipt } from './arrivals.api';
import { ArrivalTable } from './arrival-table';
import { arrivalTag, needOf, inactiveCount, outsideCount, parseQty, toArrivalRows, waitingOf, type ArrivalRow } from './arrival-rows';
import './arrivals.m1.css';

const UNLOCKED_KEY = 'arrivals.unlocked';

type Notice = { kind: 'saved'; n: number } | { kind: 'stale' } | { kind: 'failed' } | { kind: 'missing'; name: string } | null;

function AddItem({ candidates, onAdd }: { candidates: AdminItem[]; onAdd: (item: AdminItem) => void }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState('');
  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        {t('arrivals.add.open')}
      </button>
    );
  }
  const item = candidates.find((c) => c.id === picked);
  return (
    <div className="ar-add">
      {candidates.length === 0 ? (
        <p>{t('arrivals.add.none')}</p>
      ) : (
        <>
          <select aria-label={t('arrivals.add.pick')} value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">{t('arrivals.add.pickPlaceholder')}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {fmt.name(c)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!item}
            onClick={() => {
              if (!item) return;
              onAdd(item);
              setPicked('');
              setOpen(false);
            }}
          >
            {t('arrivals.add.confirm')}
          </button>
        </>
      )}
    </div>
  );
}

function ArrivalsBoard({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const fmt = useRequestFormat();
  const report = useMonthReport(ym);
  const items = useAdminItems();
  const flight = useSingleFlight();
  const refresh = useRefreshAfterFlow();
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<ArrivalRow[]>([]);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const base = useMemo(() => (report.data && items.data ? toArrivalRows(report.data, items.data) : []), [report.data, items.data]);
  const rows = useMemo(() => {
    const stockOf = new Map((items.data ?? []).map((i) => [i.id, i.stock_qty]));
    // Món thêm tay mà báo cáo (sau khi tải lại) đã có thì lấy dòng của báo cáo: không để trùng item_id
    const inBase = new Set(base.map((r) => r.item_id));
    return [...base, ...added.filter((r) => !inBase.has(r.item_id))].map((r) => {
      const stock = stockOf.get(r.item_id) ?? r.stock;
      const text = raw[r.item_id];
      return text === undefined ? { ...r, stock } : { ...r, stock, qty: parseQty(text).qty };
    });
  }, [base, added, raw, items.data]);

  if (report.isError || items.isError) return <LoadError onRetry={() => void Promise.all([report.refetch(), items.refetch()])} />;
  if (!report.data || !items.data) return <Loading />;

  const invalid = rows.some((r) => parseQty(raw[r.item_id] ?? String(r.qty)).error);
  const toSend = rows.filter((r) => r.qty > 0);
  const needing = rows.filter((r) => needOf(r) > 0);
  const covered = needing.filter((r) => arrivalTag(r) !== 'short').length;
  const units = rows.reduce((sum, r) => sum + r.qty, 0);
  const shown = new Set(rows.map((r) => r.item_id));
  const candidates = items.data.filter((i) => i.active && !shown.has(i.id));
  const outside = outsideCount(report.data);
  const inactive = inactiveCount(report.data, items.data);

  const change = (id: string, value: string) => {
    setRaw((prev) => ({ ...prev, [id]: value }));
    setNotice(null);
  };
  const reset = () => {
    setRaw({});
    setAdded([]);
    setNotice(null);
  };
  const add = (item: AdminItem) => {
    setAdded((prev) => [...prev, { item_id: item.id, name: item.name, name_en: item.name_en, unit: item.unit, image_file_id: item.image_file_id, waiting: report.data ? waitingOf(report.data, item.id) : 0, stock: item.stock_qty, qty: 1 }]);
    setRaw((prev) => ({ ...prev, [item.id]: '1' }));
  };

  const save = () =>
    flight.run(async () => {
      const lines = toSend.map((r) => ({ item_id: r.item_id, qty: r.qty, expected_stock_qty: r.stock }));
      try {
        await postReceipt({ lines, ym, ...(note.trim() ? { note: note.trim() } : {}) }, csrfToken);
        // Đợt đã lưu: dòng ở lại nhưng số về về 0 (không lưu đôi); "Nhập đợt tiếp" điền lại phần còn thiếu
        setRaw(Object.fromEntries(rows.map((r) => [r.item_id, '0'])));
        setAdded(rows.map((r) => ({ ...r, qty: 0 })));
        setNote('');
        setNotice({ kind: 'saved', n: lines.length });
        await refresh();
      } catch (e) {
        if (apiErrorCode(e) === 'STALE_UPDATE') {
          setNotice({ kind: 'stale' });
          await Promise.all([items.refetch(), report.refetch()]);
        } else if (apiErrorCode(e) === 'ITEM_NOT_FOUND') {
          const id = apiErrorString(e, 'item_id');
          const row = rows.find((r) => r.item_id === id);
          setNotice({ kind: 'missing', name: row ? fmt.name(row) : (id ?? '') });
          await Promise.all([items.refetch(), report.refetch()]);
        } else {
          setNotice({ kind: 'failed' });
        }
      }
    });

  return (
    <>
      {notice?.kind === 'saved' && (
        <div role="status" className="ar-saved">
          <span>
            <b>{t('arrivals.saved', { n: notice.n })}</b> {t('arrivals.savedNext')}
          </span>
          <button type="button" className="btn" onClick={reset}>
            {t('arrivals.nextBatch')}
          </button>
          <Link className="btn btn--primary" to="/admin/delivery">
            {t('arrivals.toDelivery')}
          </Link>
        </div>
      )}
      {(notice?.kind === 'stale' || notice?.kind === 'failed' || notice?.kind === 'missing') && (
        <p role="alert" className="ar-warn">
          {notice.kind === 'missing' ? t('arrivals.itemMissing', { name: notice.name }) : t(notice.kind === 'stale' ? 'arrivals.stale' : 'arrivals.saveFailed')}
        </p>
      )}
      <StatRow>
        <StatCard label={t('arrivals.stats.toReceive')} icon="pkg" value={needing.length} unit={t('arrivals.stats.unit')} sub={t('arrivals.stats.toReceiveSub')} />
        <StatCard label={t('arrivals.stats.units')} icon="pkgplus" value={units} unit={t('arrivals.stats.unitsUnit')} sub={t('arrivals.stats.unitsSub')} />
        <StatCard label={t('arrivals.stats.done')} icon="truck" value={covered} unit={t('arrivals.stats.unit')} sub={t('arrivals.stats.doneSub')} />
      </StatRow>
      <section className="ar-card">
        <div className="ar-tools">
          <div className="field">
            <label htmlFor="ar-note" className="field-label">
              {t('arrivals.note.label')}
            </label>
            <input id="ar-note" type="text" maxLength={500} placeholder={t('arrivals.note.placeholder')} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <AddItem key={added.length} candidates={candidates} onAdd={add} />
        </div>
        {rows.length === 0 ? <p className="ar-empty">{t('arrivals.table.empty')}</p> : <ArrivalTable rows={rows} raw={raw} onChange={change} />}
        {inactive > 0 && <p className="ar-outside">{t('arrivals.inactive', { n: inactive })}</p>}
        {outside > 0 && <p className="ar-outside">{t('arrivals.outside', { n: outside })}</p>}
        <div className="ar-foot">
          <button type="button" className="btn" onClick={reset}>
            {t('arrivals.reset')}
          </button>
          <button type="button" className="btn btn--primary" disabled={invalid || toSend.length === 0 || flight.pending} onClick={() => void save()}>
            {t('arrivals.save')}
          </button>
        </div>
      </section>
    </>
  );
}

export function ArrivalsPage() {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const lockedYm = current.data ? shiftYm(current.data.ym, -1) : undefined;
  const title = t('arrivals.title', { month: lockedYm ? monthOf(lockedYm) : '' }).trim();
  return (
    <div className="ct-page">
      <PageHeader crumbs={[t('nav.groups.monthly'), t('nav.arrivals')]} title={title} description={t('arrivals.description')} />
      {current.isError ? <LoadError onRetry={() => void current.refetch()} /> : lockedYm ? <PeriodLockGate key={lockedYm} ym={lockedYm} unlockedKey={UNLOCKED_KEY}><ArrivalsBoard ym={lockedYm} /></PeriodLockGate> : <Loading />}
    </div>
  );
}
