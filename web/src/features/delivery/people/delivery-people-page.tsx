import { useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { langOf, lockPhrase } from '@/lib/period-text';
import { shiftYm } from '@/lib/ym';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { useUrlPatch } from '@/lib/use-url-patch';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { Icon } from '@/ui/icon';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { OpenPeriodNotice } from '@/features/summary/open-period-notice';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { usePeriodSummary } from '@/features/summary/summary.api';
import { useDeliveryPeople, type DeliveryPerson } from './delivery-people.api';
import { filterPeople, overlapCount, tabCounts, type PeopleTab } from './people-filter';
import { stockShortages } from './deliver-plan';
import { DeliverDialog } from './deliver-dialog';
import { PersonAvatar, PersonCard } from './person-card';
import { PersonPanel } from './person-panel';
import { useQuickDeliver } from './use-quick-deliver';
import './delivery-people.m1.css';

const TABS: PeopleTab[] = ['pending', 'debt', 'done', 'all'];
const TABLET_DOWN = '(max-width: 1279px)';

function PanelHead({ person, inDrawer = false }: { person: DeliveryPerson; inDrawer?: boolean }) {
  const { t } = useTranslation();
  const name = person.full_name ?? person.user_sub;
  const title = inDrawer ? <DrawerTitle className="pp-head__name">{name}</DrawerTitle> : <h2 className="pp-head__name">{name}</h2>;
  return (
    <header className="pp-head">
      <PersonAvatar name={name} large />
      <div>
        {title}
        <small>{person.department ?? t('delivery.people.card.noDepartment')}</small>
      </div>
    </header>
  );
}

function PeopleBoard({ ym }: { ym: string }) {
  const { t, i18n } = useTranslation();
  const [params, update] = useUrlPatch();
  const narrow = useMediaQuery(TABLET_DOWN);
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const query = useDeliveryPeople(ym);
  const summary = usePeriodSummary(ym);
  const month = monthOf(ym);
  const people = query.data?.people ?? [];
  const asked = params.get('tab');
  const tab: PeopleTab = TABS.find((x) => x === asked) ?? 'pending';
  const q = params.get('q') ?? '';
  const listed = filterPeople(people, tab, q);
  const selected = people.find((p) => p.user_sub === params.get('person'));
  const at = selected ? listed.findIndex((p) => p.user_sub === selected.user_sub) : -1;
  const nextOf = (sub: string) => {
    const i = listed.findIndex((p) => p.user_sub === sub);
    return i < 0 ? undefined : listed[i + 1];
  };
  const open = (sub: string | null) => update({ person: sub });
  const quick = useQuickDeliver(people);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
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
  const short = stockShortages(people).size;
  const panel = selected && (
    <PersonPanel
      key={selected.user_sub}
      ym={ym}
      person={selected}
      people={people}
      next={at >= 0 ? listed[at + 1] : undefined}
      onNext={open}
      onDelivered={() => open(null)}
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
      </div>
      {short > 0 && (
        <p className="pp-short">
          <span>{t('warn.W19head', { n: short })}</span>
          <Link to="/admin/stock">{t('delivery.people.toStock')}</Link>
        </p>
      )}
      <div className="pp-split">
        {listed.length === 0 ? (
          <EmptyState title={t('delivery.people.empty')} />
        ) : (
          <div className="pp-grid" role="list" aria-label={t('delivery.people.list')}>
            {listed.map((p) => (
              <div role="listitem" key={p.user_sub}>
                <PersonCard
                  person={p}
                  selected={p.user_sub === selected?.user_sub}
                  canDeliver={quick.canDeliver(p)}
                  onView={() => open(p.user_sub)}
                  onDeliver={() => setConfirmFor(p.user_sub)}
                />
              </div>
            ))}
          </div>
        )}
        {!narrow && (
          <section className="pp-side" aria-label={selected ? (selected.full_name ?? selected.user_sub) : t('delivery.people.list')}>
            {selected ? (
              <>
                <PanelHead person={selected} />
                {panel}
              </>
            ) : (
              <p className="pp-pick">{t('delivery.people.panel.pick')}</p>
            )}
          </section>
        )}
      </div>
      {narrow && selected && (
        <Drawer open onOpenChange={(o) => !o && open(null)} width={phone ? 390 : 420}>
          <div className="drawer-header pp-drawer-head">
            <PanelHead person={selected} inDrawer />
            <DrawerClose asChild>
              <button type="button" className="sheet-close" aria-label={t('delivery.people.panel.close')}>
                <Icon name="x" />
              </button>
            </DrawerClose>
          </div>
          <div className="sheet-body">{panel}</div>
        </Drawer>
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
  const lockedYm = current.data ? shiftYm(current.data.ym, -1) : undefined;
  const title = t('delivery.people.title', { month: lockedYm ? monthOf(lockedYm) : '' }).trim();
  return (
    <div className="ct-page">
      <PageHeader crumbs={[t('nav.groups.monthly'), t('nav.delivery')]} title={title} description={t('delivery.people.description')} />
      <OpenPeriodNotice />
      {current.isError ? <LoadError onRetry={() => void current.refetch()} /> : lockedYm ? <PeopleBoard key={lockedYm} ym={lockedYm} /> : <Loading />}
    </div>
  );
}

// Trang Giao hàng bản cũ đã gỡ: dấu trang cũ về trang Giao hàng, giữ tháng
export function DeliveryClassicRedirect() {
  const { search } = useLocation();
  const ym = new URLSearchParams(search).get('ym');
  return <Navigate to={ym ? `/admin/delivery?${new URLSearchParams({ ym })}` : '/admin/delivery'} replace />;
}
