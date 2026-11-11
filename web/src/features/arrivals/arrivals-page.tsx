import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { groupCounts as countByGroup } from '@/lib/group-counts';
import { useUrlPatch } from '@/lib/use-url-patch';
import { lockedYm } from '@/lib/ym';
import { formatVnStamp } from '@/lib/format-time';
import { Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { useToast } from '@/ui/toast-context';
import { categoryLabel, useAllCategories } from '@/features/catalog/catalog.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { PeriodLockGate } from '@/features/summary/period-lock-gate';
import { NO_GROUP, applyArrivalFilter, groupOf, isAllArrived, isShort, isReceivable, parseArrivalFilter, receivableLines, toArrivalRows, type ArrivalRow } from './arrival-rows';
import { partialReceive } from './arrival-status';
import { ArrivalTable } from './arrival-table';
import { ArrivalsCustom } from './arrivals-custom';
import { ArrivalsDone } from './arrivals-done';
import { ArrivalsMakeup } from './arrivals-makeup';
import { ArrivalsToolbar } from './arrivals-toolbar';
import { useAdmOutToggle, useArrivalsPlan } from './use-arrivals-plan';
import { useArrivalsDraft } from './use-arrivals-draft';
import { useArrivalsSave, type Notice } from './use-arrivals-save';
import './arrivals.m1.css';

const CLEAR_FILTER = { q: null, g: null, short: null };

function NoticeLine({ notice, nameOf }: { notice: Notice; nameOf: (id: string) => string }) {
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

function NotSentGate({ ym, noOrderAt }: { ym: string; noOrderAt: string | null }) {
  const { t } = useTranslation();
  const month = monthOf(ym);
  return (
    <section role="status" className="ar-card ar-gate">
      <p>{noOrderAt ? t('arrivals.gate.noOrder', { month, time: formatVnStamp(noOrderAt) }) : t('arrivals.gate.notSent', { month })}</p>
      <Link className="btn btn--primary" to="/admin/reports">
        {t('arrivals.gate.toReports')}
      </Link>
    </section>
  );
}

function ArrivalsBoard({ ym }: { ym: string }) {
  const { t, i18n } = useTranslation();
  const fmt = useRequestFormat();
  const toast = useToast();
  const planQ = useArrivalsPlan(ym);
  const cats = useAllCategories();
  const [params, patchUrl] = useUrlPatch();
  const draft = useArrivalsDraft();
  const saver = useArrivalsSave(ym);
  const adm = useAdmOutToggle(ym);
  const [note, setNote] = useState('');
  // Nhóm đã tick cho nút "Nhận đủ hàng / Nhận hàng (n nhóm)" trên thanh
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  if (planQ.isError || cats.isError) return <LoadError onRetry={() => void Promise.all([planQ.refetch(), cats.refetch()])} />;
  if (!planQ.data || !cats.data) return <Loading />;
  const plan = planQ.data;
  const snapshot = plan.snapshot;
  const filter = parseArrivalFilter(params);
  const catById = new Map(cats.data.map((c) => [c.id, c]));
  const known = new Set(catById.keys());
  const labelOf = (g: string) => {
    const c = catById.get(g);
    return c ? categoryLabel(c, i18n.language) : t('arrivals.group.none');
  };

  const rows = toArrivalRows(plan);
  const done = isAllArrived(plan);
  const nameOf = (id: string) => {
    const r = rows.find((x) => x.item_id === id);
    return r ? fmt.name(r) : id;
  };

  const afterSide = async (code: string | null, saved?: number, failedYm?: string) => {
    saver.setNotice(failedYm ? { kind: 'makeup', ym: failedYm, code: code ?? 'UNKNOWN' } : code ? { kind: 'error', code } : null);
    if ((!code || failedYm) && saved) toast.show({ text: t('arrivals.makeup.saved', { n: saved }), tone: 'ok' });
    await saver.refresh();
  };

  // Chưa gửi NCC (hoặc tháng không cần đề nghị): không có đơn nào để đối chiếu hàng về → không cho nhận.
  // Về bù kỳ trước vẫn nhận được vì kỳ đó đã gửi
  if (!snapshot) {
    return (
      <>
        <NoticeLine notice={saver.notice} nameOf={nameOf} />
        <NotSentGate ym={ym} noOrderAt={plan.no_order?.at ?? null} />
        <ArrivalsMakeup groups={plan.makeup} onDone={afterSide} />
      </>
    );
  }

  const visible = applyArrivalFilter(rows, filter, known);
  const counts = countByGroup(rows, (r) => groupOf(r, known), NO_GROUP);
  const groups = [...counts.keys()].map((id) => ({ id, label: labelOf(id) }));
  const sections = groups
    .map((g) => ({ ...g, rows: visible.filter((r) => groupOf(r, known) === g.id), all: rows.filter((r) => groupOf(r, known) === g.id) }))
    .filter((s) => s.rows.length > 0);

  // Theo mọi dòng của nhóm (không theo lọc): nhóm đã tick vẫn lưu khi đang bị lọc ẩn
  const rowsOfGroups = (ids: ReadonlySet<string>) => rows.filter((r) => ids.has(groupOf(r, known)));
  const hasError = (rs: ArrivalRow[]) => rs.some((r) => draft.errorOf(r));
  // Nhóm đã tick nhưng không còn dòng nhận được (vừa lưu đủ, ADM hết hàng) không tính
  const pickedIds = new Set([...picked].filter((id) => rowsOfGroups(new Set([id])).some(isReceivable)));
  const pickedRows = rowsOfGroups(pickedIds);
  const toSend = receivableLines(pickedRows, draft.qtyOf);

  // Lưu ngay, không hỏi xác nhận: xóa số đã gõ của các nhóm vừa lưu (ô gõ 0 về lại phần còn thiếu cho đợt sau),
  // bỏ tick các nhóm vừa lưu;
  // ghi chú đã đi theo đợt vừa lưu nên xóa để không gắn lại vào đợt sau
  const receive = (groupIds: ReadonlySet<string>, lines: { row: ArrivalRow; qty: number }[]) =>
    saver.save(lines, note, snapshot.id, () => {
      draft.clearMany(rowsOfGroups(groupIds).map((r) => r.item_id));
      setNote('');
      setPicked((prev) => new Set([...prev].filter((id) => !groupIds.has(id))));
    });
  const pickOf = (id: string) => {
    const rs = rowsOfGroups(new Set([id]));
    const lines = receivableLines(rs, draft.qtyOf);
    return {
      picked: picked.has(id),
      canReceive: lines.length > 0 && !hasError(rs) && !saver.pending,
      onPick: (on: boolean) =>
        setPicked((prev) => {
          const next = new Set(prev);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        }),
      onReceive: () => void receive(new Set([id]), lines),
    };
  };
  const toggleAdm = async (key: string, on: boolean) => {
    const code = await adm.toggle(key, on);
    draft.clear(key);
    saver.setNotice(code ? { kind: 'error', code } : null);
  };

  return (
    <>
      <NoticeLine notice={saver.notice} nameOf={nameOf} />
      <ArrivalsToolbar
        snapshot={snapshot}
        filter={filter}
        groups={groups}
        counts={counts}
        total={rows.length}
        shown={visible.length}
        shortCount={rows.filter(isShort).length}
        reducedCount={rows.filter((r) => r.reduced > 0).length}
        batch={{ groups: pickedIds.size, items: toSend.length, partial: partialReceive(pickedRows, draft.qtyOf) }}
        saveDisabled={hasError(pickedRows) || toSend.length === 0 || saver.pending}
        onFilter={(patch) => patchUrl(patch, true)}
        onSave={() => void receive(pickedIds, toSend)}
      />
      {done && <ArrivalsDone plan={plan} ym={ym} admBusy={adm.busy} onToggleAdm={(key, on) => void toggleAdm(key, on)} />}
      {/* Đã nhận xong: không bày bảng số 0, chỉ còn khối tổng kết */}
      {!done && (
        <section className="ar-card">
          {visible.length === 0 ? (
            <div className="ar-nomatch">
              <b>{t('arrivals.filter.none')}</b>
              <button type="button" className="btn" onClick={() => patchUrl(CLEAR_FILTER, true)}>
                {t('arrivals.filter.clear')}
              </button>
            </div>
          ) : (
            <ArrivalTable sections={sections} draft={draft} admBusy={adm.busy} pickOf={pickOf} onToggleAdm={(r) => void toggleAdm(r.item_id, !r.adm_out)} />
          )}
          <div className="ar-foot">
            <div className="field">
              <label htmlFor="ar-note" className="field-label">
                {t('arrivals.note.label')}
              </label>
              <input id="ar-note" type="text" maxLength={500} placeholder={t('arrivals.note.placeholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </section>
      )}
      <ArrivalsCustom ym={ym} snapshotId={snapshot.id} rows={plan.custom} admBusy={adm.busy} onToggleAdm={(key, on) => void toggleAdm(key, on)} onSaved={afterSide} />
      <ArrivalsMakeup groups={plan.makeup} onDone={afterSide} />
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
      <PageHeader crumbs={[t('nav.groups.monthly'), t('nav.arrivals')]} title={title} />
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
