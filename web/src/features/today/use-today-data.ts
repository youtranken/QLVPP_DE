import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiErrorCode } from '@/lib/api-error';
import { lockedYm } from '@/lib/ym';
import { currentPeriodQuery } from '@/features/request/request.api';
import { REVIEW_BADGE_KEY, reviewLinesQuery } from '@/features/review/review.api';
import { periodSummaryQuery } from '@/features/summary/summary.api';
import { deliveryPeopleQuery } from '@/features/delivery/people/delivery-people.api';
import { useBacklog } from '@/features/delivery/backlog.api';
import { arrivalsPlanQuery } from '@/features/arrivals/arrivals.api';
import { useStockData } from '@/features/stock/use-stock-data';
import { BADGE_FRESH } from '@/shell/use-admin-badges';
import type { TileSource, TodayData } from './today-tiles';

export type SourceState = { failed: boolean; retry: () => void };

// Kỳ chưa khóa: chưa có gì để giao/nhận — coi như rỗng, không phải lỗi
const notLocked = (q: UseQueryResult) => q.isError && apiErrorCode(q.error) === 'PERIOD_NOT_LOCKED';
const failedOf = (q: UseQueryResult) => q.isError && !notLocked(q);

export function useTodayData(now: Date): { data: TodayData; sources: Record<TileSource, SourceState> } {
  const period = useQuery({ ...currentPeriodQuery(), ...BADGE_FRESH });
  const openYm = period.data?.ym;
  const workingYm = openYm ? lockedYm(openYm) : undefined;
  const summary = useQuery(periodSummaryQuery(openYm));
  const review = useQuery({ ...reviewLinesQuery('pending', ''), queryKey: [...REVIEW_BADGE_KEY], ...BADGE_FRESH });
  const people = useQuery({ ...deliveryPeopleQuery(workingYm), ...BADGE_FRESH });
  const arrivals = useQuery({ ...arrivalsPlanQuery(workingYm ?? ''), enabled: !!workingYm });
  const backlog = useBacklog('person');
  const stock = useStockData();

  const periodFailed = period.isError;
  const dependent = (q: UseQueryResult): SourceState => ({
    failed: periodFailed || failedOf(q),
    retry: () => void (periodFailed ? period.refetch() : q.refetch()),
  });
  const data: TodayData = {
    now,
    period: period.data,
    summary: summary.data,
    review: review.data?.items,
    people: notLocked(people) ? [] : people.data?.people,
    arrivals: notLocked(arrivals) ? { snapshot: null, no_order: null, batches: [], rows: [], custom: [], makeup: [] } : arrivals.data,
    backlog: backlog.data?.groups,
    stockRows: stock.loaded ? stock.rows : undefined,
  };
  return {
    data,
    sources: {
      period: { failed: periodFailed || summary.isError, retry: () => void (periodFailed ? period.refetch() : summary.refetch()) },
      review: { failed: review.isError, retry: () => void review.refetch() },
      people: dependent(people),
      arrivals: dependent(arrivals),
      backlog: { failed: backlog.isError, retry: () => void backlog.refetch() },
      stock: { failed: stock.failed, retry: stock.retry },
    },
  };
}
