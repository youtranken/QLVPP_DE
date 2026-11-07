import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { groupCounts } from '@/lib/group-counts';
import { useUrlPatch } from '@/lib/use-url-patch';
import { lockedYm } from '@/lib/ym';
import { Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { useToast } from '@/ui/toast-context';
import { categoryLabel, useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { PeriodLockGate } from '@/features/summary/period-lock-gate';
import { NO_GROUP, applyArrivalFilter, differingRows, fullBatch, groupOf, isAllArrived, isShort, parseArrivalFilter, toArrivalRows } from './arrival-rows';
import { ArrivalTable } from './arrival-table';
import { FullConfirm, SaveConfirm } from './arrivals-confirm';
import { ArrivalsCustom } from './arrivals-custom';
import { ArrivalsDone } from './arrivals-done';
import { ArrivalsMakeup } from './arrivals-makeup';
import { ArrivalsToolbar, type FullBlock } from './arrivals-toolbar';
import { useAdmOutToggle, useArrivalsPlan } from './use-arrivals-plan';
import { useArrivalsDraft } from './use-arrivals-draft';
import { useArrivalsSave, type Notice } from './use-arrivals-save';
import './arrivals.m1.css';

const CLEAR_FILTER = { q: null, g: null, short: null };

function NoticeLine({ notice, nameOf, onRetry }: { notice: Notice; nameOf: (id: string) => string; onRetry: () => void }) {
  const { t, i18n } = useTranslation();
  if (!notice) return null;
  if (notice.kind === 'saved') {
    return (
      <div role="status" className="ar-saved">
        <span>
          <b>{t('arrivals.saved', { n: notice.n })}</b> {t('arrivals.savedNext')}
        </span>
        <Link className="btn btn--primary" to="/admin/delivery">
          {t('arrivals.toDelivery')}
        </Link>
      </div>
    );
  }
  if (notice.kind === 'partial') {
    return (
      <div role="alert" className="ar-warn">
        <span>{t('arrivals.full.partial', { x: notice.x, n: notice.n })}</span>{' '}
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          {t('arrivals.full.retry')}
        </button>
      </div>
    );
  }
  if (notice.kind === 'customFailed') {
    return (
      <div role="alert" className="ar-warn">
        <span>{t('arrivals.full.customFailed', { n: notice.n })}</span>{' '}
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          {t('arrivals.full.retry')}
        </button>
      </div>
    );
  }
  const reason = (code: string, itemId?: string) =>
    code === 'STALE_UPDATE'
      ? t('arrivals.stale')
      : code === 'ITEM_NOT_FOUND' && itemId
        ? t('arrivals.itemMissing', { name: nameOf(itemId) })
        : i18n.exists(`common.errors.${code}`)
          ? t(`common.errors.${code}`)
          : null;
  if (notice.kind === 'makeup') {
    return (
      <p role="alert" className="ar-warn">
        {[t('arrivals.makeup.failed', { month: monthOf(notice.ym) }), reason(notice.code)].filter(Boolean).join(' ')}
      </p>
    );
  }
  return (
    <p role="alert" className="ar-warn">
      {reason(notice.code, notice.itemId) ?? t('arrivals.saveFailed')}
    </p>
  );
}

function ArrivalsBoard({ ym }: { ym: string }) {
  const { t, i18n } = useTranslation();
  const fmt = useRequestFormat();
  const toast = useToast();
  const planQ = useArrivalsPlan(ym);
  const items = useAdminItems();
  const cats = useAllCategories();
  const [params, patchUrl] = useUrlPatch();
  const draft = useArrivalsDraft();
  const saver = useArrivalsSave(ym);
  const adm = useAdmOutToggle(ym);
  const [added, setAdded] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [dialog, setDialog] = useState<'save' | 'full' | null>(null);

  if (planQ.isError || items.isError || cats.isError) return <LoadError onRetry={() => void Promise.all([planQ.refetch(), items.refetch(), cats.refetch()])} />;
  if (!planQ.data || !items.data || !cats.data) return <Loading />;
  const plan = planQ.data;
  const filter = parseArrivalFilter(params);
  const catById = new Map(cats.data.map((c) => [c.id, c]));
  const known = new Set(catById.keys());
  const labelOf = (g: string) => {
    const c = catById.get(g);
    return c ? categoryLabel(c, i18n.language) : t('arrivals.group.none');
  };

  const rows = toArrivalRows(plan, added.flatMap((id) => items.data.filter((i) => i.id === id)));
  const done = isAllArrived(plan);
  // Đã về đủ: chỉ còn bày hàng thêm tay
  const tableRows = done ? rows.filter((r) => r.added) : rows;
  const visible = applyArrivalFilter(tableRows, filter, known);
  const counts = groupCounts(rows, (r) => groupOf(r, known), NO_GROUP);
  const groups = [...counts.keys()].map((id) => ({ id, label: labelOf(id) }));
  const sections = groups
    .map((g) => ({ ...g, rows: visible.filter((r) => groupOf(r, known) === g.id), all: tableRows.filter((r) => groupOf(r, known) === g.id) }))
    .filter((s) => s.rows.length > 0);

  const batch = fullBatch(rows);
  const customLeft = plan.custom.filter((c) => c.remaining > 0 && !c.adm_out);
  const fullBlock: FullBlock = plan.no_order ? 'noOrder' : !plan.snapshot ? 'noSnapshot' : saver.pending ? 'sending' : batch.lines.length === 0 && customLeft.length === 0 ? 'allDone' : null;
  const toSend = tableRows.filter((r) => !r.adm_out && draft.qtyOf(r) > 0).map((row) => ({ row, qty: draft.qtyOf(row) }));
  const invalid = tableRows.some((r) => draft.errorOf(r));
  const diffs = differingRows(tableRows, draft.qtyOf);
  const shown = new Set(rows.map((r) => r.item_id));
  const candidates = items.data
    .filter((i) => i.usable && !shown.has(i.id))
    .map((i) => ({ id: i.id, label: fmt.name(i), group: labelOf(groupOf(i, known)), search: [i.name, i.name_en, i.code].filter(Boolean).join(' ') }));

  const afterSave = () => {
    draft.reset();
    setNote('');
    setAdded([]);
  };
  const doSave = async () => {
    await saver.save(toSend, note, plan.snapshot?.id ?? null, afterSave);
    setDialog(null);
  };
  const runFull = (lines: typeof batch.lines) =>
    saver.full(lines, customLeft, plan.snapshot?.id ?? null, () => {
      draft.reset();
      if (lines.length > 0) toast.show({ text: t('arrivals.full.done', { x: lines.length }), tone: 'ok' });
    });
  const doFull = async () => {
    await runFull(batch.lines);
    setDialog(null);
  };
  const toggleAdm = async (key: string, on: boolean) => {
    const code = await adm.toggle(key, on);
    draft.clear(key);
    saver.setNotice(code ? { kind: 'error', code } : null);
  };
  const afterSide = async (code: string | null, saved?: number, failedYm?: string) => {
    saver.setNotice(failedYm ? { kind: 'makeup', ym: failedYm, code: code ?? 'UNKNOWN' } : code ? { kind: 'error', code } : null);
    if ((!code || failedYm) && saved) toast.show({ text: t('arrivals.makeup.saved', { n: saved }), tone: 'ok' });
    await saver.refresh();
  };
  const nameOf = (id: string) => {
    const r = rows.find((x) => x.item_id === id);
    return r ? fmt.name(r) : id;
  };

  return (
    <>
      <NoticeLine notice={saver.notice} nameOf={nameOf} onRetry={() => void runFull([])} />
      <ArrivalsToolbar
        plan={plan}
        filter={filter}
        groups={groups}
        counts={counts}
        total={rows.length}
        shown={visible.length}
        shortCount={rows.filter(isShort).length}
        reducedCount={rows.filter((r) => r.reduced > 0).length}
        fullBlock={fullBlock}
        candidates={candidates}
        onFilter={(patch) => patchUrl(patch, true)}
        onFull={() => setDialog('full')}
        onAdd={(id) => setAdded((prev) => [...prev, id])}
      />
      {done && <ArrivalsDone plan={plan} ym={ym} admBusy={adm.busy} onToggleAdm={(key, on) => void toggleAdm(key, on)} />}
      {(!done || tableRows.length > 0) && (
        <section className="ar-card">
          {tableRows.length === 0 ? (
            <p className="ar-empty">{t('arrivals.table.empty')}</p>
          ) : visible.length === 0 ? (
            <div className="ar-nomatch">
              <b>{t('arrivals.filter.none')}</b>
              <button type="button" className="btn" onClick={() => patchUrl(CLEAR_FILTER, true)}>
                {t('arrivals.filter.clear')}
              </button>
            </div>
          ) : (
            <ArrivalTable sections={sections} draft={draft} admBusy={adm.busy} onToggleAdm={(r) => void toggleAdm(r.item_id, !r.adm_out)} />
          )}
          <div className="ar-foot">
            <div className="field">
              <label htmlFor="ar-note" className="field-label">
                {t('arrivals.note.label')}
              </label>
              <input id="ar-note" type="text" maxLength={500} placeholder={t('arrivals.note.placeholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="button" className="btn" onClick={draft.reset}>
              {t('arrivals.reset')}
            </button>
            <button type="button" className="btn btn--primary" disabled={invalid || toSend.length === 0 || saver.pending} onClick={() => (diffs.length > 0 ? setDialog('save') : void doSave())}>
              {t('arrivals.save')}
            </button>
          </div>
        </section>
      )}
      <ArrivalsCustom ym={ym} snapshotId={plan.snapshot?.id ?? null} rows={plan.custom} admBusy={adm.busy} onToggleAdm={(key, on) => void toggleAdm(key, on)} onSaved={afterSide} />
      <ArrivalsMakeup groups={plan.makeup} onDone={afterSide} />
      {dialog === 'save' && <SaveConfirm diffs={diffs} pending={saver.pending} onBack={() => setDialog(null)} onSave={() => void doSave()} />}
      {dialog === 'full' && plan.snapshot && (
        <FullConfirm
          s={{
            items: batch.lines.length,
            units: batch.units,
            time: formatVnStamp(plan.snapshot.created_at),
            skip: batch.skip,
            custom: customLeft.length,
            reduced: batch.lines.filter((r) => r.reduced > 0).length,
            replacesDraft: draft.typed(rows),
          }}
          pending={saver.pending}
          onBack={() => setDialog(null)}
          onConfirm={() => void doFull()}
        />
      )}
    </>
  );
}

export function ArrivalsPage() {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const workingYm = current.data ? lockedYm(current.data.ym) : undefined;
  const title = t('arrivals.title', { month: workingYm ? monthOf(workingYm) : '' }).trim();
  return (
    <div className="ct-page">
      <PageHeader crumbs={[t('nav.groups.monthly'), t('nav.arrivals')]} title={title} description={t('arrivals.description')} />
      {current.isError ? (
        <LoadError onRetry={() => void current.refetch()} />
      ) : workingYm ? (
        <PeriodLockGate key={workingYm} ym={workingYm}>
          <ArrivalsBoard ym={workingYm} />
        </PeriodLockGate>
      ) : (
        <Loading />
      )}
    </div>
  );
}
