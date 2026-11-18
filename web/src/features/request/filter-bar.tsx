import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GroupChips } from '@/ui/filter/group-chips';
import { ScrollFade } from '@/ui/filter/scroll-fade';
import { SearchBox } from '@/ui/filter/search-box';
import type { FilterState } from './item-filters';
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
  copy?: ReactNode;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
}

// Lưới cố định theo nhóm: chỉ ô tìm + chip nhóm; "Thêm món khác" ở thẻ cuối lưới và trong giỏ
export function FilterBar({ filter, groups, total, shown, copy, onChange, onClear }: Props) {
  const { t } = useTranslation();
  return (
    <div className="rq-f">
      <div className="rq-f-row">
        <SearchBox
          className="rq-f-search"
          urlParam="q"
          label={t('request.grid.search')}
          placeholder={t('request.grid.searchPlaceholder')}
          value={filter.q}
          onChange={(q) => onChange({ q })}
        />
        {copy && <span className="rq-f-copy">{copy}</span>}
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
      </div>
      <p className="rq-f-count" aria-live="polite">
        {filter.q !== '' && t('request.grid.countMatch', { count: shown })}
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
