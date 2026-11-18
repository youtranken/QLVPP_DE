import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { ActiveFilters, ShownCount } from '@/ui/list-meta';
import { Segmented } from '@/ui/segmented';
import { Toolbar } from '@/ui/toolbar';
import type { PersonRow } from '@/features/summary/summary.api';
import { MonthAreaFilter } from './month-area-filter';
import { MONTH_CHIPS, chipCounts, isLeftOwing, type MonthChip } from './month-chips';
import type { MonthView } from './use-month-params';

const MAX_SEARCH = 100;

export function MonthToolbar({ switcher, children }: { switcher: ReactNode; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Toolbar label={t('month.toolbar')} lead={switcher}>
      {children}
    </Toolbar>
  );
}

interface Props {
  switcher: ReactNode;
  view: MonthView;
  onView: (v: MonthView) => void;
  rows: PersonRow[];
  // Danh sách chưa nạp xong: số đếm "—" thay vì số của dữ liệu dở dang; "Đang hiện" chờ có số đúng
  loading: boolean;
  chip: MonthChip;
  q: string;
  left: boolean;
  areas: readonly string[];
  areaOptions: string[];
  shown: number;
  total: number;
  onChip: (c: MonthChip) => void;
  onQ: (q: string) => void;
  onLeft: (on: boolean) => void;
  onAreas: (a: readonly string[]) => void;
  onClear: () => void;
}

export function MonthFilters(p: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useUrlSearchBox(p.q, p.onQ);
  const people = p.view === 'people';
  const counts = chipCounts(p.rows);
  const leftCount = p.rows.filter(isLeftOwing).length;
  const count = (n: number) => (p.loading ? t('month.value.none') : n);
  const viewSwitch = (
    <Segmented
      label={t('month.view.label')}
      value={p.view}
      options={[
        { value: 'people', label: t('month.view.people') },
        { value: 'items', label: t('month.view.items') },
      ]}
      onChange={p.onView}
    />
  );
  return (
    <div className="mk-filters">
      <Toolbar
        label={t('month.toolbar')}
        lead={
          <>
            {viewSwitch}
            {p.switcher}
          </>
        }
        search={people ? { value: search, onChange: setSearch, label: t('month.search'), placeholder: t('month.search'), maxLength: MAX_SEARCH } : undefined}
      >
        {people && <MonthAreaFilter options={p.areaOptions} value={p.areas} onChange={p.onAreas} />}
      </Toolbar>
      {people && (
        <div className="mk-chiprow">
          <Segmented label={t('month.chips.label')} value={p.chip} options={MONTH_CHIPS.map((c) => ({ value: c, label: t(`month.chips.${c}`), count: count(counts[c]) }))} onChange={p.onChip} />
          {(leftCount > 0 || p.left) && (
            <button type="button" className="flt-chip" aria-pressed={p.left} onClick={() => p.onLeft(!p.left)}>
              {t('month.chips.left')}
              <span className="flt-cnt">{count(leftCount)}</span>
            </button>
          )}
          {!p.loading && (
            <ShownCount shown={p.shown} total={p.total} filtering={Boolean(p.q) || p.chip !== 'all' || p.left || p.areas.length > 0}>
              {t('month.table.meta', { shown: p.shown, total: p.total })}
            </ShownCount>
          )}
        </div>
      )}
      {people && <ActiveFilters items={p.areas.map((a) => ({ key: a, label: a, onRemove: () => p.onAreas(p.areas.filter((x) => x !== a)) }))} onClearAll={p.onClear} />}
    </div>
  );
}
