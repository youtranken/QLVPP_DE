import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { langOf, lockPhrase } from '@/lib/period-text';
import { useMe } from '@/lib/me';
import { lockedYm } from '@/lib/ym';
import { Loading, LoadError } from '@/ui/load-state';
import { Segmented } from '@/ui/segmented';
import { arrivalsPlanQuery } from '@/features/arrivals/arrivals.api';
import { useBacklog } from '@/features/delivery/backlog.api';
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
  if (summary.unregistered === 0 && custom === 0 && !review.isError && lowItems.length === 0 && !low.isError) return null;
  return (
    <div className="hm-cards">
      {summary.unregistered > 0 && <UnregisteredSection ym={ym} deadline={summary.deadline} count={summary.unregistered} />}
      {review.isError ? <CardError onRetry={() => void review.refetch()} /> : custom > 0 && <CustomCard count={custom} />}
      {low.isError ? <CardError onRetry={() => void low.refetch()} /> : lowItems.length > 0 && <LowStockCard items={lowItems} />}
    </div>
  );
}

// Người đã nghỉ: phần chưa nhận của kỳ giao giảm ở Tổng hợp, nợ tháng trước hủy ở Còn nợ (lý do chọn sẵn ở cả hai)
function LeftReminder({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const left = useLeftPeople(ym, true);
  const backlog = useBacklog('person');
  const inPeriod = left.data?.items ?? [];
  const debtors = (backlog.data?.groups ?? []).flatMap((g) => g.lines.slice(0, 1)).filter((l) => l.user_status !== 'active');
  const names = new Map<string, string>();
  for (const p of inPeriod) names.set(p.user_sub, p.full_name ?? p.email ?? p.user_sub);
  for (const l of debtors) if (!names.has(l.user_sub)) names.set(l.user_sub, l.full_name ?? l.user_sub);
  if (names.size === 0) return null;
  return (
    <div className="alert alert--warn hm-left">
      <span>{t('warn.W25', { n: names.size, names: [...names.values()].join(', ') })}</span>
      {inPeriod.length > 0 && (
        <Link className="btn btn--sm" to={`/admin/summary?ym=${ym}&left=1`}>
          {t('home.left.action')}
        </Link>
      )}
      {debtors.length > 0 && (
        <Link className="btn btn--sm" to="/admin/backlog?left=1">
          {t('home.left.debt')}
        </Link>
      )}
    </div>
  );
}

function Ready({ currentYm }: { currentYm: string }) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const workingYm = lockedYm(currentYm);
  const [view, setView] = useState<View>('locked');
  const current = usePeriodSummary(currentYm);
  const locked = usePeriodSummary(workingYm);
  // Gửi ADM và Hàng về chỉ có nghĩa khi kỳ giao đã khóa
  const lockedDone = locked.data?.is_open === false;
  const send = useSendState(workingYm, lockedDone);
  const plan = useQuery({ ...arrivalsPlanQuery(workingYm), enabled: lockedDone });
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
      summaryYm: workingYm,
    },
    t,
  );
  const currentSteps = monthSteps({ registered: current.data.registered, headcount: current.data.headcount, isOpen: current.data.is_open, send: null, plan: null, pendingDelivery: 0, summaryYm: workingYm }, t);
  const registerView = view === 'current';
  const doing = lockedSteps.find((s) => s.current);
  const hero = registerView
    ? { title: t('home.hero.titleRegister', { month: monthOf(currentYm) }), sub: t('home.hero.subRegister', { lock: current.data.deadline ? lockPhrase(current.data.deadline, langOf(i18n.language)) : '' }) }
    : doing
      ? { title: t('home.hero.titleStep', { month: monthOf(workingYm), step: t(`home.step.${doing.key}`) }), sub: t(`home.hero.sub.${doing.key}`) }
      : { title: t('home.hero.titleDone', { month: monthOf(workingYm) }), sub: t('home.hero.subDone') };

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
              { value: 'locked', label: t('home.period.locked', { month: monthOf(workingYm) }) },
              { value: 'current', label: t('home.period.current', { month: monthOf(currentYm) }) },
            ]}
          />
        </div>
        <MonthSteps steps={registerView ? currentSteps : lockedSteps} onlyFirst={registerView} />
      </section>
      {/* Kỳ đang đăng ký không có cảnh báo W nào */}
      {!registerView && lockedDone && <LeftReminder ym={workingYm} />}
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
