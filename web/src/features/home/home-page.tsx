import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { vnLockDate } from '@/lib/format-time';
import { useMe } from '@/lib/me';
import { shiftYm } from '@/lib/ym';
import { Loading, LoadError } from '@/ui/load-state';
import { Segmented } from '@/ui/segmented';
import { arrivalsPlanQuery } from '@/features/arrivals/arrivals.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { reviewLinesQuery } from '@/features/review/review.api';
import { useSendState } from '@/features/send-adm/use-send-state';
import { lowStockQuery } from '@/features/stock/stock.api';
import { useLeftPeople, usePeriodSummary, useUnregistered, type PeriodSummary } from '@/features/summary/summary.api';
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

// W25 (Đ41, R-D13.11): người đã nghỉ còn phần chưa nhận ở kỳ giao → "Xử lý" mở Tổng hợp lọc ?left=1 (lý do giảm chọn sẵn "Người đã nghỉ")
function LeftReminder({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const left = useLeftPeople(ym, true);
  const people = left.data?.items ?? [];
  if (people.length === 0) return null;
  const names = people.map((p) => p.full_name ?? p.email ?? p.user_sub).join(', ');
  return (
    <div className="alert alert--warn hm-left">
      <span>{t('warn.W25', { n: people.length, names })}</span>
      <Link className="btn btn--sm" to={`/admin/summary?ym=${ym}&left=1`}>
        {t('home.left.action')}
      </Link>
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
  // Gửi ADM và Hàng về chỉ có nghĩa khi kỳ giao đã khóa
  const lockedDone = locked.data?.is_open === false;
  const send = useSendState(lockedYm, lockedDone);
  const plan = useQuery({ ...arrivalsPlanQuery(lockedYm), enabled: lockedDone });
  const queries = [current, locked, send.query, plan];
  const failed = queries.find((q) => q.isError);
  if (failed) return <LoadError onRetry={() => void Promise.all(queries.filter((q) => q.isError).map((q) => q.refetch()))} />;
  if (!current.data || !locked.data || (lockedDone && (!send.query.data || !plan.data))) return <Loading />;

  const sent = send.sent;
  const lockedSteps = monthSteps(
    {
      registered: locked.data.registered,
      headcount: locked.data.headcount,
      isOpen: locked.data.is_open,
      send: send.state ? { state: send.state, at: sent?.created_at ?? send.noOrder?.at ?? null, items: sent?.items_count ?? 0, units: sent?.units_total ?? 0, changed: send.changedAfter } : null,
      plan: plan.data ?? null,
      pendingDelivery: locked.data.lines_pending_delivery ?? 0,
    },
    t,
  );
  const currentSteps = monthSteps({ registered: current.data.registered, headcount: current.data.headcount, isOpen: current.data.is_open, send: null, plan: null, pendingDelivery: 0 }, t);
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
      {/* Đ6: kỳ đang đăng ký không có cảnh báo W nào */}
      {!registerView && lockedDone && <LeftReminder ym={lockedYm} />}
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
