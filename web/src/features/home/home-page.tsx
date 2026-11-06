import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { vnLockDate } from '@/lib/format-time';
import { useMe } from '@/lib/me';
import { shiftYm } from '@/lib/ym';
import { Loading, LoadError } from '@/ui/load-state';
import { Segmented } from '@/ui/segmented';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { toArrivalRows } from '@/features/arrivals/arrival-rows';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { useMonthReport, useSnapshots } from '@/features/reports/reports.api';
import { reviewLinesQuery } from '@/features/review/review.api';
import { lowStockQuery } from '@/features/stock/stock.api';
import { usePeriodSummary, useUnregistered, type PeriodSummary } from '@/features/summary/summary.api';
import { CardError, CustomCard, LowStockCard, UnregisteredCard } from './home-cards';
import { monthSteps } from './month-steps';
import { MonthSteps } from './month-steps-list';
import './home.m1.css';

type View = 'locked' | 'current';

function UnregisteredSection({ ym, deadline, count }: { ym: string; deadline: string | null; count: number }) {
  const people = useUnregistered(ym);
  return <UnregisteredCard ym={ym} deadline={deadline} count={count} people={people.data?.items ?? null} failed={people.isError} onRetry={() => void people.refetch()} />;
}

function Cards({ ym, summary }: { ym: string; summary: PeriodSummary }) {
  const review = useQuery(reviewLinesQuery('pending', ''));
  const low = useQuery(lowStockQuery());
  const custom = review.data?.items.length ?? 0;
  const lowItems = low.data ?? [];
  const showCustom = custom > 0 || review.isError;
  const showLow = lowItems.length > 0 || low.isError;
  if (summary.unregistered === 0 && !showCustom && !showLow) return null;
  return (
    <div className="hm-cards">
      {summary.unregistered > 0 && <UnregisteredSection ym={ym} deadline={summary.deadline} count={summary.unregistered} />}
      {(showCustom || showLow) && (
        <div className="hm-side">
          {review.isError ? <CardError onRetry={() => void review.refetch()} /> : custom > 0 && <CustomCard count={custom} />}
          {low.isError ? <CardError onRetry={() => void low.refetch()} /> : lowItems.length > 0 && <LowStockCard items={lowItems} />}
        </div>
      )}
    </div>
  );
}

function Ready({ currentYm }: { currentYm: string }) {
  const { t } = useTranslation();
  const me = useMe();
  const lockedYm = shiftYm(currentYm, -1);
  const [view, setView] = useState<View>('locked');
  const current = usePeriodSummary(currentYm);
  const locked = usePeriodSummary(lockedYm);
  const snapshots = useSnapshots(lockedYm);
  const report = useMonthReport(lockedYm);
  const items = useAdminItems();
  const queries = [current, locked, snapshots, report, items];
  const failed = queries.find((q) => q.isError);
  if (failed) return <LoadError onRetry={() => void Promise.all(queries.map((q) => q.refetch()))} />;
  if (!current.data || !locked.data || !snapshots.data || !report.data || !items.data) return <Loading />;

  const lockedSteps = monthSteps({
    registered: locked.data.registered,
    headcount: locked.data.headcount,
    isOpen: locked.data.is_open,
    snapshots: snapshots.data.items.length,
    // Cùng tập dòng với trang Hàng về: bỏ món đã ngừng dùng (server không nhập kho cho món đó)
    needTotal: toArrivalRows(report.data, items.data).reduce((n, r) => n + r.qty, 0),
    receipts: locked.data.receipts,
    pendingDelivery: locked.data.lines_pending_delivery ?? 0,
  });
  const currentSteps = monthSteps({ registered: current.data.registered, headcount: current.data.headcount, isOpen: current.data.is_open, snapshots: 0, needTotal: 0, receipts: 0, pendingDelivery: 0 });
  const registerView = view === 'current';
  const doing = lockedSteps.find((s) => s.current);
  const hero = registerView
    ? { title: t('home.hero.titleRegister', { month: monthOf(currentYm) }), sub: t('home.hero.subRegister', { date: current.data.deadline ? vnLockDate(current.data.deadline) : '' }) }
    : doing
      ? { title: t('home.hero.titleStep', { month: monthOf(lockedYm), step: t(`home.step.${doing.key}`) }), sub: t(`home.hero.sub.${doing.key}`) }
      : { title: t('home.hero.titleDone', { month: monthOf(lockedYm) }), sub: t('home.hero.subDone') };

  return (
    <div className="hm-page">
      <h1 className="hm-greeting">{t('home.greeting', { name: me.fullName ?? me.email ?? me.sub })}</h1>
      <section aria-labelledby="hm-hero" className="hm-hero">
        <div className="hm-hero__head">
          <div>
            <h2 id="hm-hero">{hero.title}</h2>
            <p>{hero.sub}</p>
          </div>
          <Segmented<View>
            label={t('home.period.label')}
            value={view}
            onChange={setView}
            options={[
              { value: 'locked', label: t('home.period.locked', { month: monthOf(lockedYm) }) },
              { value: 'current', label: t('home.period.current', { month: monthOf(currentYm) }) },
            ]}
          />
        </div>
        <MonthSteps steps={registerView ? currentSteps : lockedSteps} onlyFirst={registerView} />
      </section>
      <Cards ym={currentYm} summary={current.data} />
    </div>
  );
}

export function HomePage() {
  const period = useCurrentPeriod();
  if (period.isError) return <LoadError onRetry={() => void period.refetch()} />;
  if (!period.data) return <Loading />;
  return <Ready currentYm={period.data.ym} />;
}
