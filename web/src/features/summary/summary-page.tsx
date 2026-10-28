import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { KpiStrip } from './kpi-strip';
import { ItemTable } from './item-table';
import { PersonTable } from './person-table';
import { UnregisteredCopy } from './unregistered-copy';
import { usePeriodSummary, type PeriodSummary, type SummaryFilter } from './summary.api';
import '@/features/admin/admin.css';
import './summary.css';

type View = 'person' | 'item';
const VIEWS: View[] = ['person', 'item'];
// Cùng mẫu với api/src/common/ym.ts: tháng 01–12, giá trị khác rơi về kỳ đang mở
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const noop = () => {};

function PeriodHead({ ym, openYm, summary, onMonth }: {
  ym: string;
  openYm: string;
  summary: PeriodSummary | undefined;
  onMonth: (ym: string) => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return (
    <div className="a-toolbar sm-head">
      <MonthSwitcher
        value={ym}
        max={openYm}
        onChange={onMonth}
        formatLabel={(v) => t('summary.month', { month: monthOf(v), year: v.slice(0, 4) })}
        labels={{ group: t('summary.monthNav'), prev: t('summary.prevMonth'), next: t('summary.nextMonth') }}
      />
      {summary &&
        (summary.is_open ? (
          <span className="tag tag--brand">
            {t('summary.open', { day: summary.deadline ? fmt.lastDay(summary.deadline) : '' })}
          </span>
        ) : (
          <span className="tag">{t('summary.locked')}</span>
        ))}
      <span className="sp" />
      {summary && <UnregisteredCopy ym={ym} deadline={summary.deadline} count={summary.unregistered} />}
    </div>
  );
}

// Trang chủ Hành chính; ?ym= giữ tháng đang xem khi tải lại, không vượt kỳ đang mở
export function SummaryPage({ onAdjust = noop }: { onAdjust?: (requestId: string) => void }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const current = useCurrentPeriod();
  const openYm = current.data?.ym;
  const asked = params.get('ym');
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : openYm;
  const summary = usePeriodSummary(ym);
  const [view, setView] = useState<View>('person');
  const [filter, setFilter] = useState<SummaryFilter>('all');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);

  if (current.isError) return <LoadError onRetry={() => void current.refetch()} />;
  if (!ym || !openYm) return <Loading />;

  const pickFilter = (next: SummaryFilter) => {
    setFilter(next);
    setView('person');
  };

  return (
    <div className="a-stack">
      <PeriodHead ym={ym} openYm={openYm} summary={summary.data} onMonth={(v) => setParams({ ym: v })} />
      {summary.isError && <LoadError onRetry={() => void summary.refetch()} />}
      {summary.data && <KpiStrip summary={summary.data} filter={filter} onFilter={pickFilter} />}
      <section className="a-panel">
        <div className="a-toolbar sm-tools">
          {view === 'person' && (
            <input
              className="a-input admin-search"
              type="search"
              value={search}
              placeholder={t('summary.search')}
              aria-label={t('summary.search')}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div role="radiogroup" aria-label={t('summary.view')} className="seg seg--sm sm-view">
            {VIEWS.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}>
                {t(v === 'person' ? 'summary.byPerson' : 'summary.byItem')}
              </button>
            ))}
          </div>
          <span className="sp" />
          {view === 'person' && filter !== 'all' && (
            <span className="sm-filtering">
              {t('summary.filtering', { name: t(`summary.filters.${filter}`) })}
              <button type="button" className="btn btn--sm" onClick={() => setFilter('all')}>
                {t('summary.clearFilter')}
              </button>
            </span>
          )}
        </div>
        {view === 'person' ? <PersonTable ym={ym} filter={filter} q={q} onAdjust={onAdjust} /> : <ItemTable ym={ym} />}
      </section>
    </div>
  );
}
