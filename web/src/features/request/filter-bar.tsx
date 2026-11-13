import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { MEMBER_MID_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { GroupChips } from '@/ui/filter/group-chips';
import { ScrollFade } from '@/ui/filter/scroll-fade';
import { SearchBox } from '@/ui/filter/search-box';
import { Listbox } from '@/ui/listbox';
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
  // 901–1180 (giỏ chiếm cột phải): hàng trên chỉ vừa tìm · sắp xếp · Đã chọn · Thêm món khác; nút "Chép lại…" (rộng)
  // sang cuối hàng chip thay vì rớt một mình xuống dòng
  const mid = useMediaQuery(MEMBER_MID_QUERY);
  const copySlot = copy && <span className="rq-f-copy">{copy}</span>;
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
        {/* Hai cặp chỉ là nhóm bố cục cho điện thoại; máy tính bỏ khung (display: contents) */}
        <div className="rq-f-pair">
          <Listbox
            className="rq-f-sort"
            variant="pill"
            aria-label={t('request.grid.sort')}
            value={filter.sort}
            onChange={(sort) => onChange({ sort })}
            options={SORT_KEYS.filter(([key]) => canFav || key !== 'fav').map(([key, label]) => ({ value: key, label: t(label) }))}
          />
          <button type="button" className="rq-f-chip" aria-pressed={filter.onlyPicked} onClick={() => onChange({ onlyPicked: !filter.onlyPicked })}>
            {t('request.grid.picked')} <span className="rq-f-cnt">{pickedCount}</span>
          </button>
        </div>
        <div className="rq-f-pair rq-f-pair--act">
          <button type="button" className="rq-f-add" onClick={onAddCustom}>
            + {t('request.grid.addOther')}
          </button>
          {!mid && copySlot}
        </div>
      </div>
      <div className="rq-f-chiprow">
        {/* Khung cuộn ngang (≤ 1180): mép phải mờ khi còn chip khuất */}
        <ScrollFade className="rq-f-scroll">
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
        </ScrollFade>
        {mid && copySlot}
      </div>
      <p className="rq-f-count" aria-live="polite">
        {t(narrowed ? 'request.grid.countMatch' : 'request.grid.countAll', { count: narrowed ? shown : total })}
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
