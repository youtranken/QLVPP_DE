import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shiftYm } from '@/lib/ym';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { usePeriodSummary } from '@/features/summary/summary.api';
import { DeliveryDetail } from './delivery-detail';
import { DeliveryList } from './delivery-list';
import { DeliveryStrip } from './delivery-strip';
import { useDeliveryBoard } from './use-delivery-board';
import { useDeliveryParams } from './use-delivery-params';
import './delivery.m1.css';

function NothingToDeliver({ month, showAll }: { month: number; showAll: boolean }) {
  const { t } = useTranslation();
  if (showAll) return <EmptyState title={t('delivery.page.emptyAll')} />;
  return (
    <EmptyState
      art="nothing-deliver"
      title={t('delivery.page.emptyTitle')}
      hint={t('delivery.page.emptyHint', { month })}
      action={
        <Link className="btn" to="/admin/backlog">
          {t('delivery.page.toBacklog')}
        </Link>
      }
    />
  );
}

function DeliveryBoard({ ym, p }: { ym: string; p: ReturnType<typeof useDeliveryParams> }) {
  const { t } = useTranslation();
  const b = useDeliveryBoard(ym, p);
  const registered = usePeriodSummary(ym).data?.registered;
  const month = monthOf(ym);
  const { source, phone } = b;
  const detail = p.requestId ? <DeliveryDetail key={p.requestId} requestId={p.requestId} onCompleted={b.onCompleted} /> : null;
  // Điện thoại: hai màn theo ?request= — có phiếu thì chỉ chi tiết toàn màn
  if (phone && detail) return detail;
  if (source.isError) return <LoadError onRetry={() => void source.refetch()} />;
  if (source.isPending) return <Loading />;
  const serverCount = source.data.pages.reduce((n, pg) => n + pg.items.length, 0);
  return (
    <>
      <DeliveryStrip ym={ym} pendingCount={b.pendingCount} phone={phone} />
      {b.rows.length === 0 ? (
        <NothingToDeliver month={month} showAll={p.showAll} />
      ) : (
        <div className="dv-split">
          <DeliveryList
            month={month}
            rows={b.rows}
            count={serverCount}
            counts={phone ? { pending: b.pendingCount, all: registered } : undefined}
            showAll={p.showAll}
            selectedId={p.requestId}
            leaving={b.leaving}
            busy={source.isPlaceholderData}
            more={source.hasNextPage ? { loading: source.isFetchingNextPage, onMore: () => void source.fetchNextPage() } : undefined}
            onShowAll={p.setShowAll}
            onSelect={(id) => p.select(id)}
          />
          {!phone && (detail ?? <p className="dv-pick">{t('delivery.page.pick')}</p>)}
        </div>
      )}
    </>
  );
}

export function DeliveryPage() {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const lockedYm = current.data ? shiftYm(current.data.ym, -1) : undefined;
  const p = useDeliveryParams(lockedYm);
  const title = t('delivery.page.title');
  const header = (actions?: ReactNode) => (
    <PageHeader crumbs={[t('nav.groups.monthly'), title]} title={title} description={t('delivery.page.description')} actions={actions} />
  );

  if (current.isError) return <>{header()}<LoadError onRetry={() => void current.refetch()} /></>;
  if (!p.ym || !lockedYm) return <>{header()}<Loading /></>;
  const ym = p.ym;
  return (
    <div className="dv-page">
      {header(
        <MonthSwitcher
          value={ym}
          max={lockedYm}
          onChange={p.setMonth}
          status={{ tone: 'dark', label: t('delivery.page.locked') }}
          formatLabel={(v) => t('delivery.month', { month: monthOf(v), year: v.slice(0, 4) })}
          labels={{ group: t('delivery.page.monthNav'), prev: t('delivery.page.prevMonth'), next: t('delivery.page.nextMonth') }}
        />,
      )}
      <DeliveryBoard key={ym} ym={ym} p={p} />
    </div>
  );
}
