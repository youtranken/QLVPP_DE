import { useCallback, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { langOf, lockPhrase } from '@/lib/period-text';
import { lockedYm } from '@/lib/ym';
import { usePanelParam } from '@/lib/use-panel-param';
import { useUrlPatch } from '@/lib/use-url-patch';
import { OverlayPanel } from '@/ui/overlay-panel';
import { Icon } from '@/ui/icon';
import { SearchClear } from '@/ui/search-clear';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { SelectBox } from '@/ui/data-table-row';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { usePeriodSummary } from '@/features/summary/summary.api';
import { useDeliveryPeople, type DeliveryPerson } from './delivery-people.api';
import { filterPeople, overlapCount, tabCounts, type PeopleTab } from './people-filter';
import { stockShortages } from './deliver-plan';
import { bulkPlan, type BulkPlan } from './bulk-plan';
import { BulkDeliverDialog } from './bulk-deliver-dialog';
import { DeliverDialog } from './deliver-dialog';
import { PeopleTable, PersonAvatar } from './people-table';
import { PersonPanel } from './person-panel';
import { useQuickDeliver } from './use-quick-deliver';
import './delivery-people.m1.css';

const NO_PEOPLE: DeliveryPerson[] = [];
const TABS: PeopleTab[] = ['pending', 'debt', 'done', 'all'];

function PanelHead({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  return (
    <header className="pp-head">
      <PersonAvatar name={person.full_name ?? person.user_sub} large />
      <small>{person.department ?? t('delivery.people.card.noDepartment')}</small>
    </header>
  );
}

function PeopleBoard({ ym }: { ym: string }) {
  const { t, i18n } = useTranslation();
  const [params, update] = useUrlPatch();
  const query = useDeliveryPeople(ym);
  const summary = usePeriodSummary(ym);
  const month = monthOf(ym);
  const people = query.data?.people ?? NO_PEOPLE;
  const asked = params.get('tab');
  const tab: PeopleTab = TABS.find((x) => x === asked) ?? 'pending';
  const q = params.get('q') ?? '';
  const listed = filterPeople(people, tab, q);
  const panel = usePanelParam('person', {
    order: listed.map((p) => p.user_sub),
    known: (sub) => (query.data ? people.some((p) => p.user_sub === sub) : undefined),
  });
  const selected = people.find((p) => p.user_sub === panel.id);
  const at = panel.index;
  const nextOf = (sub: string) => {
    const i = listed.findIndex((p) => p.user_sub === sub);
    return i < 0 ? undefined : listed[i + 1];
  };
  const open = (sub: string) => panel.open(sub);
  const quick = useQuickDeliver(people);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  // Kế hoạch chụp lúc bấm: làm mới danh sách giữa chừng không đổi số đang gửi
  const [bulk, setBulk] = useState<BulkPlan | null>(null);
  const bulkable = useMemo(() => new Set(bulkPlan(people, people).summary.map((s) => s.user_sub)), [people]);
  const selectable = useCallback((p: DeliveryPerson) => bulkable.has(p.user_sub), [bulkable]);
  // Người đã rời bộ lọc hoặc không còn gì giao được thì tự rơi khỏi tập chọn
  const chosen = listed.filter((p) => picked.has(p.user_sub) && bulkable.has(p.user_sub));
  const toggle = useCallback((sub: string) => setPicked((prev) => (prev.has(sub) ? new Set([...prev].filter((s) => s !== sub)) : new Set([...prev, sub]))), []);
  const toggleAll = useCallback(
    (checked: boolean) => {
      const subs = listed.filter(selectable).map((p) => p.user_sub);
      setPicked((prev) => (checked ? new Set([...prev, ...subs]) : new Set([...prev].filter((s) => !subs.includes(s)))));
    },
    [listed, selectable],
  );
  const searchRef = useRef<HTMLInputElement>(null);
  // Giao xong: về ô tìm, chọn sẵn chữ để gõ ngay người kế
  const focusSearch = () => {
    const input = searchRef.current;
    if (!input?.isConnected) return false;
    input.focus();
    input.select();
    return true;
  };
  const confirming = people.find((p) => p.user_sub === confirmFor);

  if (query.isError) {
    if (apiErrorCode(query.error) !== 'PERIOD_NOT_LOCKED') return <LoadError onRetry={() => void query.refetch()} />;
    const deadline = apiErrorString(query.error, 'deadline') ?? summary.data?.deadline;
    return <EmptyState title={deadline ? t('summary.gate.unlocked', { month, lockPhrase: lockPhrase(deadline, langOf(i18n.language)) }) : t('summary.gate.unlockedNoDate', { month })} />;
  }
  if (!query.data) return <Loading />;
  if (people.length === 0) return <EmptyState title={t('delivery.people.emptyAll', { month })} />;

  const counts = tabCounts(people);
  const both = overlapCount(people);
  const pickable = listed.filter(selectable);
  const allPicked = pickable.length > 0 && pickable.every((p) => picked.has(p.user_sub));
  const shortages = stockShortages(people);
  const personPanel = selected && (
    <PersonPanel
      key={selected.user_sub}
      ym={ym}
      person={selected}
      people={people}
      next={at >= 0 ? listed[at + 1] : undefined}
      onNext={open}
      onDelivered={panel.close}
      focusAfter={focusSearch}
    />
  );
  return (
    <>
      <div className="toolbar pp-toolbar">
        <div className="toolbar__search">
          <Icon name="search" size={18} />
          <input
            ref={searchRef}
            type="search"
            aria-label={t('delivery.people.searchLabel')}
            placeholder={t('delivery.people.searchPlaceholder')}
            value={q}
            onChange={(e) => update({ q: e.target.value || null }, true)}
          />
          <SearchClear value={q} onClear={() => update({ q: null }, true)} inputRef={searchRef} />
        </div>
        <div className="pp-tabs">
          <Segmented
            label={t('delivery.people.filter')}
            value={tab}
            options={TABS.map((x) => ({ value: x, label: t(`delivery.people.tabs.${x}`), count: counts[x] }))}
            onChange={(v) => update({ tab: v === 'pending' ? null : v })}
          />
          {both > 0 && <small className="pp-tabs__note">{t('delivery.people.overlap', { n: both })}</small>}
        </div>
        {pickable.length > 0 && (
          <label className="pt-pickall">
            <SelectBox checked={allPicked} indeterminate={chosen.length > 0 && !allPicked} label={t('delivery.bulk.pickAllPhone')} onChange={toggleAll} />
            <span aria-hidden="true">{t('delivery.bulk.pickAllPhone')}</span>
          </label>
        )}
        {chosen.length > 0 && (
          <div className="pt-bulk">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPicked(new Set())}>
              {t('delivery.bulk.clear')}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setBulk(bulkPlan(chosen, people))}>
              {t('delivery.bulk.button', { count: chosen.length })}
            </button>
          </div>
        )}
      </div>
      {listed.length === 0 ? (
        <EmptyState title={t('delivery.people.empty')} />
      ) : (
        <PeopleTable
          rows={listed}
          shortages={shortages}
          selected={picked}
          selectable={selectable}
          canDeliver={quick.canDeliver}
          activeId={selected?.user_sub}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onView={open}
          onDeliver={setConfirmFor}
        />
      )}
      {selected && (
        <OverlayPanel
          open
          onClose={panel.close}
          title={selected.full_name ?? selected.user_sub}
          nav={{ index: panel.index, total: panel.total, onStep: panel.step, prevLabel: t('delivery.people.panel.prevPerson'), nextLabel: t('delivery.people.panel.nextPerson') }}
        >
          <PanelHead person={selected} />
          {personPanel}
        </OverlayPanel>
      )}
      {bulk && (
        <BulkDeliverDialog
          plan={bulk}
          people={people}
          onClose={() => setBulk(null)}
          onDone={() => {
            setBulk(null);
            setPicked(new Set());
          }}
        />
      )}
      {confirming && (
        <DeliverDialog
          key={confirming.user_sub}
          person={confirming}
          people={people}
          next={nextOf(confirming.user_sub)}
          onNext={open}
          onClose={() => setConfirmFor(null)}
          onDone={() => setConfirmFor(null)}
          onOpenPerson={() => {
            setConfirmFor(null);
            open(confirming.user_sub);
          }}
          focusAfter={focusSearch}
        />
      )}
    </>
  );
}

export function DeliveryPeoplePage() {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const workingYm = current.data ? lockedYm(current.data.ym) : undefined;
  const title = t('delivery.people.title', { month: workingYm ? monthOf(workingYm) : '' }).trim();
  return (
    <div className="ct-page">
      <PageHeader crumbs={[t('nav.groups.monthly'), t('nav.delivery')]} title={title} />
      {current.isError ? <LoadError onRetry={() => void current.refetch()} /> : workingYm ? <PeopleBoard key={workingYm} ym={workingYm} /> : <Loading />}
    </div>
  );
}

// Trang Giao hàng bản cũ đã gỡ: dấu trang cũ về trang Giao hàng, giữ tháng
export function DeliveryClassicRedirect() {
  const { search } = useLocation();
  const ym = new URLSearchParams(search).get('ym');
  return <Navigate to={ym ? `/admin/delivery?${new URLSearchParams({ ym })}` : '/admin/delivery'} replace />;
}
