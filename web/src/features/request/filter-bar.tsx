import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { GroupChips } from '@/ui/filter/group-chips';
import { SearchBox } from '@/ui/filter/search-box';
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
  // Chỉ có "Hay dùng trước" khi có phiếu kỳ trước
  canFav?: boolean;
  searchRef?: RefObject<HTMLInputElement | null>;
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

export function FilterBar({ filter, groups, total, shown, pickedCount, canFav = false, searchRef, copy, onChange, onClear, onAddCustom }: Props) {
  const { t } = useTranslation();
  const narrowed = filter.q !== '' || filter.onlyPicked || filter.group !== 'all';
  return (
    <div className="rq-f">
      <div className="rq-f-row">
        <SearchBox
          className="rq-f-search"
          inputRef={searchRef}
          label={t('request.grid.search')}
          placeholder={t('request.grid.searchPlaceholder')}
          value={filter.q}
          onChange={(q) => onChange({ q })}
        />
        <label className="rq-f-sort">
          <span className="sr-only">{t('request.grid.sort')}</span>
          <select value={filter.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
            {SORT_KEYS.filter(([key]) => canFav || key !== 'fav').map(([key, label]) => (
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
      <GroupChips
        className="rq-f-chips"
        chipClassName="rq-f-chip"
        countClassName="rq-f-cnt"
        label={t('request.grid.categories')}
        allLabel={t('request.grid.all')}
        total={total}
        groups={groups}
        counts={new Map(groups.map((g) => [g.id, g.n]))}
        value={filter.group}
        onChange={(group) => onChange({ group })}
      />
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
