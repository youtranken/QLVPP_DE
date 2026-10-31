import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { vnDeadlineDay, vnLockDate } from '@/lib/format-time';
import { Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { Toolbar } from '@/ui/toolbar';
import { useAdminItems } from '@/features/catalog/catalog.api';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { AdjustDrawer } from './adjust-drawer';
import { CreateRequestDialog } from './create-request-dialog';
import { SummaryItemTable } from './summary-item-table';
import { SummaryPersonTable } from './summary-person-table';
import { SummaryStats } from './summary-stats';
import { UnregisteredCopy } from './unregistered-copy';
import { UnregisteredTable } from './unregistered-table';
import { usePeriodSummary, type PeriodSummary } from './summary.api';
import { useAdjacentRequests } from './use-person-table-rows';
import { useSummaryParams, type SummaryView } from './use-summary-params';
import '@/features/admin/admin.css';
import './summary.m1.css';

const MAX_SEARCH = 100;

// Gõ → đẩy q (debounce) lên URL; q đổi từ ngoài (Back, liên kết) → đồng bộ lại ô
function useSearchBox(q: string, setQ: (v: string) => void) {
  const [text, setText] = useState(q);
  const debounced = useDebouncedValue(text.trim(), 300);
  const pushed = useRef(q);
  const push = useRef(setQ);
  useEffect(() => {
    push.current = setQ;
  });
  useEffect(() => {
    if (debounced === pushed.current) return;
    pushed.current = debounced;
    push.current(debounced);
  }, [debounced]);
  useEffect(() => {
    if (q === pushed.current) return;
    pushed.current = q;
    setText(q);
  }, [q]);
  return [text, setText] as const;
}

function MonthControl({ ym, openYm, summary, onChange }: { ym: string; openYm: string; summary?: PeriodSummary; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const status = summary
    ? summary.is_open
      ? { tone: 'ok' as const, label: t('summary.page.open', { day: summary.deadline ? vnDeadlineDay(summary.deadline) : '' }) }
      : { tone: 'dark' as const, label: t('summary.page.locked') }
    : undefined;
  return (
    <MonthSwitcher
      value={ym}
      max={openYm}
      onChange={onChange}
      status={status}
      formatLabel={(v) => t('summary.page.month', { month: monthOf(v), year: v.slice(0, 4) })}
      labels={{ group: t('summary.page.monthNav'), prev: t('summary.page.prevMonth'), next: t('summary.page.nextMonth') }}
    />
  );
}

export function SummaryPage() {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const openYm = current.data?.ym;
  const p = useSummaryParams(openYm);
  const summary = usePeriodSummary(p.ym);
  const items = useAdminItems();
  const [search, setSearch] = useSearchBox(p.q, p.setQ);
  const [creating, setCreating] = useState<{ user: DirectoryUser | null } | null>(null);
  const personFilter = p.filter === 'low' || p.filter === 'unregistered' ? null : p.filter;
  const listed = p.view === 'person' && p.filter !== 'unregistered';
  const adjacent = useAdjacentRequests(p.ym, personFilter, p.q, listed ? p.requestId : null);
  const title = t('summary.page.title');
  const header = (actions?: ReactNode) => (
    <PageHeader crumbs={[t('nav.groups.monthly'), title]} title={title} description={t('summary.page.description')} actions={actions} />
  );

  if (current.isError) return <>{header()}<LoadError onRetry={() => void current.refetch()} /></>;
  if (!p.ym || !openYm) return <>{header()}<Loading /></>;

  const ym = p.ym;
  const data = summary.data;
  const canCreate = ym === openYm;
  const outCount = (items.data ?? []).filter((i) => i.active && i.stock_state === 'out').length;
  const views = [
    { value: 'person' as SummaryView, label: t('summary.page.byPerson') },
    { value: 'item' as SummaryView, label: t('summary.page.byItem') },
  ];

  return (
    <div className="sm-page">
      {header(<MonthControl ym={ym} openYm={openYm} summary={data} onChange={p.setMonth} />)}
      {summary.isError && <LoadError onRetry={() => void summary.refetch()} />}
      {data && <SummaryStats summary={data} outCount={outCount} filter={p.filter} onFilter={p.toggleFilter} />}
      <Toolbar
        search={{
          value: search,
          onChange: setSearch,
          label: t(p.view === 'item' ? 'summary.page.searchItem' : 'summary.page.search'),
          placeholder: t(p.view === 'item' ? 'summary.page.searchItem' : 'summary.page.search'),
          maxLength: MAX_SEARCH,
        }}
      >
        <Segmented label={t('summary.page.view')} value={p.view} options={views} onChange={p.setView} />
        <span className="sm-spacer" />
        {data && <UnregisteredCopy ym={ym} deadline={data.deadline} count={data.unregistered} />}
        {data && (
          <button type="button" className="btn btn--primary" onClick={() => setCreating({ user: null })}>
            {t('summary.create.button')}
          </button>
        )}
      </Toolbar>
      {p.filter === 'unregistered' ? (
        <UnregisteredTable ym={ym} canCreate={canCreate} onCreate={(user) => setCreating({ user })} onClearFilter={p.clearFilter} />
      ) : p.view === 'item' ? (
        <SummaryItemTable ym={ym} q={p.q} lowOnly={p.filter === 'low'} />
      ) : (
        <SummaryPersonTable
          ym={ym}
          locked={data?.is_open === false}
          filter={personFilter}
          q={p.q}
          activeId={p.requestId ?? undefined}
          onOpen={p.openAdjust}
          onClearFilter={p.clearFilter}
        />
      )}
      {p.requestId && (
        <AdjustDrawer
          requestId={p.requestId}
          onClose={p.closeAdjust}
          onPrev={adjacent.prev ? () => p.stepAdjust(adjacent.prev!) : undefined}
          onNext={adjacent.next ? () => p.stepAdjust(adjacent.next!) : undefined}
        />
      )}
      {creating && (
        <CreateRequestDialog
          ym={ym}
          lockedOn={canCreate ? undefined : data?.deadline ? vnLockDate(data.deadline) : null}
          initialUser={creating.user}
          onClose={() => setCreating(null)}
          onCreated={() => setCreating(null)}
          onOpenExisting={(id) => {
            setCreating(null);
            p.openAdjust(id);
          }}
        />
      )}
    </div>
  );
}
