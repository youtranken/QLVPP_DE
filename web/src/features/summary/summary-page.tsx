import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { usePanelParam } from '@/lib/use-panel-param';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { vnDeadlineDay } from '@/lib/format-time';
import { Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { Toolbar } from '@/ui/toolbar';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { AdjustDrawer } from './adjust-drawer';
import { SummaryCopy } from './summary-actions';
import { SummaryItemTable } from './summary-item-table';
import { SummaryPersonTable } from './summary-person-table';
import { SummaryStats } from './summary-stats';
import { UnregisteredTable } from './unregistered-table';
import { OpenPeriodNotice } from './open-period-notice';
import { usePeriodSummary, type PeriodSummary } from './summary.api';
import { useRequestOrder } from './use-person-table-rows';
import { useSummaryParams, type SummaryView } from './use-summary-params';
import './summary.m1.css';

const MAX_SEARCH = 100;

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
  const [search, setSearch] = useUrlSearchBox(p.q, p.setQ);
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const personFilter = p.filter === 'low' || p.filter === 'unregistered' ? null : p.filter;
  const listed = p.view === 'person' && p.filter !== 'unregistered';
  const requestOpen = new URLSearchParams(useLocation().search).has('request');
  const order = useRequestOrder(p.ym, personFilter, p.q, listed && requestOpen);
  const panel = usePanelParam('request', { order: listed ? order : undefined });
  const title = t('summary.page.title');
  const header = (actions?: { primary: ReactNode; secondary: ReactNode }) => (
    <PageHeader crumbs={[t('nav.groups.monthly'), title]} title={title} description={t('summary.page.description')} {...actions} />
  );

  if (current.isError) return <>{header()}<LoadError onRetry={() => void current.refetch()} /></>;
  if (!p.ym || !openYm) return <>{header()}<Loading /></>;

  const ym = p.ym;
  const data = summary.data;
  // Kỳ khóa không có phiếu nào: khung trống thay bảng, vẫn kèm danh sách chưa đăng ký
  const emptyLocked = data?.is_open === false && data.registered === 0;
  // Hết và sắp hết cùng một nguồn (món dùng được), chưa tải xong thì ô ghi "—" thay vì số tạm
  const usable = items.data?.filter((i) => i.usable);
  const stock = usable && { out: usable.filter((i) => i.stock_state === 'out').length, low: usable.filter((i) => i.stock_state === 'low').length };
  const searchKey = p.view === 'item' ? 'summary.page.searchItem' : 'summary.page.search';
  // 390: chữ ngắn để ô tìm cùng hàng vẫn đọc hết "Tìm người…"
  const views = [
    { value: 'person' as SummaryView, label: t(phone ? 'summary.page.byPersonShort' : 'summary.page.byPerson'), ariaLabel: phone ? t('summary.page.byPerson') : undefined },
    { value: 'item' as SummaryView, label: t(phone ? 'summary.page.byItemShort' : 'summary.page.byItem'), ariaLabel: phone ? t('summary.page.byItem') : undefined },
  ];

  return (
    <div className="ct-page sm-page">
      {header(
        data && {
          secondary: <SummaryCopy ym={ym} deadline={data.deadline} unregistered={data.unregistered} />,
          primary: (
            <Link className="btn btn--primary" to={`/admin/send-adm?ym=${ym}`}>
              {t('summary.page.toSendAdm')}
            </Link>
          ),
        },
      )}
      <OpenPeriodNotice />
      {summary.isError && <LoadError onRetry={() => void summary.refetch()} />}
      {data && <SummaryStats summary={data} stock={stock} filter={p.filter} onFilter={p.toggleFilter} />}
      <Toolbar
        lead={<MonthControl ym={ym} openYm={openYm} summary={data} onChange={p.setMonth} />}
        search={{
          value: search,
          onChange: setSearch,
          label: t(searchKey),
          placeholder: t(phone && p.view === 'person' ? 'summary.page.searchShort' : searchKey),
          maxLength: MAX_SEARCH,
        }}
      >
        <Segmented label={t('summary.page.view')} value={p.view} options={views} onChange={p.setView} />
        {data?.is_open === false && p.view === 'person' && (
          <button type="button" className="flt-chip" aria-pressed={p.filter === 'over_max'} onClick={() => p.toggleFilter('over_max')}>
            {t('summary.filters.over_max')}
          </button>
        )}
      </Toolbar>
      <div className="ct-block">
        {!data ? null : emptyLocked ? (
          <>
            <p className="sm-empty-period">{t('summary.emptyPeriod', { month: monthOf(ym), headcount: data.headcount })}</p>
            <UnregisteredTable ym={ym} />
          </>
        ) : p.filter === 'unregistered' ? (
          <UnregisteredTable ym={ym} onClearFilter={p.clearFilter} />
        ) : p.view === 'item' ? (
          <SummaryItemTable ym={ym} q={p.q} lowOnly={p.filter === 'low'} item={p.item} onClearItem={p.clearItem} />
        ) : (
          <SummaryPersonTable
            ym={ym}
            locked={data?.is_open === false}
            filter={personFilter}
            q={p.q}
            activeId={panel.id ?? undefined}
            onOpen={panel.open}
            onClearFilter={p.clearFilter}
          />
        )}
      </div>
      {panel.id && (
        <AdjustDrawer
          requestId={panel.id}
          presetReason={p.presetReason}
          onClose={panel.close}
          nav={listed ? { index: panel.index, total: panel.total, onStep: panel.step } : undefined}
        />
      )}
    </div>
  );
}
