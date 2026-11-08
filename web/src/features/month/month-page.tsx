import { useTranslation } from 'react-i18next';
import { Loading, LoadError } from '@/ui/load-state';
import { usePeriodSummary } from '@/features/summary/summary.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { MonthLockedView } from './month-locked-view';
import { MonthOpenView } from './month-open-view';
import { PeriodSwitch } from './period-switch';
import { useMonthParams } from './use-month-params';
import '@/features/summary/summary.m1.css';
import './month.m1.css';

export function MonthPage() {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const openYm = current.data?.ym;
  const p = useMonthParams(openYm);
  const summary = usePeriodSummary(p.ym);
  if (current.isError) return <LoadError onRetry={() => void current.refetch()} />;
  if (!p.ym || !openYm) return <Loading />;
  return (
    <div className="ct-page sm-page mk-page">
      <div className="mk-head">
        <h1>{t('month.title', { month: monthOf(p.ym) })}</h1>
        <PeriodSwitch ym={p.ym} openYm={openYm} earliestYm={summary.data?.earliest_ym} onChange={p.setYm} />
      </div>
      {p.ym === openYm ? (
        <MonthOpenView ym={p.ym} />
      ) : (
        <MonthLockedView ym={p.ym} openYm={openYm} chip={p.chip} q={p.q} left={p.left} presetReason={p.presetReason} onChip={p.setChip} onQ={p.setQ} />
      )}
    </div>
  );
}
