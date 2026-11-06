import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { IconSearch } from '@/ui/icons';
import type { FilterState, SortKey } from './item-filters';
import './filter-bar.m1.css';

export interface GroupChip {
  id: string;
  label: string;
  n: number;
}

interface Props {
  filter: FilterState;
  groups: GroupChip[];
  total: number;
  shown: number;
  pickedCount: number;
  copy?: ReactNode;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  onAddCustom: () => void;
}

const SORT_KEYS: [SortKey, string][] = [
  ['fav', 'request.grid.sortFav'],
  ['az', 'request.grid.sortAz'],
  ['group', 'request.grid.sortGroup'],
];

export function FilterBar({ filter, groups, total, shown, pickedCount, copy, onChange, onClear, onAddCustom }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useUrlSearchBox(filter.q, (q) => onChange({ q }));
  const chip = (id: string, label: string, n: number) => (
    <button key={id} type="button" className="rq-f-chip" aria-pressed={filter.group === id} onClick={() => onChange({ group: id })}>
      {label} <span className="rq-f-cnt">{n}</span>
    </button>
  );
  const narrowed = filter.q !== '' || filter.onlyPicked || filter.group !== 'all';
  return (
    <div className="rq-f">
      <div className="rq-f-row">
        <label className="rq-f-search">
          <IconSearch />
          <input
            type="search"
            aria-label={t('request.grid.search')}
            placeholder={t('request.grid.searchPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label className="rq-f-sort">
          <span className="sr-only">{t('request.grid.sort')}</span>
          <select value={filter.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
            {SORT_KEYS.map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="rq-f-chip" aria-pressed={filter.onlyPicked} onClick={() => onChange({ onlyPicked: !filter.onlyPicked })}>
          {t('request.grid.picked')} <span className="rq-f-cnt">{pickedCount}</span>
        </button>
        <button type="button" className="rq-f-add" onClick={onAddCustom}>
          + {t('request.grid.addOther')}
        </button>
        {copy && <span className="rq-f-copy">{copy}</span>}
      </div>
      <div className="rq-f-chips" role="group" aria-label={t('request.grid.categories')}>
        {chip('all', t('request.grid.all'), total)}
        {groups.map((g) => chip(g.id, g.label, g.n))}
      </div>
      <p className="rq-f-count" aria-live="polite">
        {t(narrowed ? 'request.grid.countMatch' : 'request.grid.countAll', { n: narrowed ? shown : total })}
      </p>
      {shown === 0 && (
        <div className="rq-f-empty">
          <b>{t('request.grid.emptyTitle')}</b>
          <span>{t('request.grid.emptyHint')}</span>
          <button type="button" className="rq-f-clear" onClick={onClear}>
            {t('request.grid.clear')}
          </button>
        </div>
      )}
    </div>
  );
}
