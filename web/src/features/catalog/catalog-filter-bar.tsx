import { useTranslation } from 'react-i18next';
import { ALL_GROUPS, GroupChips } from '@/ui/filter/group-chips';
import { SearchBox } from '@/ui/filter/search-box';
import { categoryLabel } from './catalog.api';
import { NO_GROUP, type CategoryIndex } from './catalog-rows';
import { CatalogBulkBar, type CatalogBulkBarProps } from './catalog-bulk-bar';
import { CatalogTabBar, ViewSwitch } from './catalog-tab-bar';
import type { CatalogTab, CatalogViewMode } from './catalog-tabs';

export type CatalogBulk = Omit<CatalogBulkBarProps, 'tab'>;

interface Props {
  q: string;
  onSearch: (q: string) => void;
  searchable: number;
  mode: CatalogViewMode;
  onMode: (m: CatalogViewMode) => void;
  tab: CatalogTab;
  // null = đang tải: chưa hiện tab và chip nhóm
  tabCounts: Record<CatalogTab, number> | null;
  onTab: (t: CatalogTab) => void;
  index: CategoryIndex;
  counts: Map<string, number>;
  total: number;
  group: string | null;
  onGroup: (g: string | null) => void;
  collapse: { all: boolean; onToggle: () => void } | null;
  bulk: CatalogBulk | null;
}

// Nhóm đã ngừng chỉ hiện khi còn món; "Chưa xếp nhóm" chỉ hiện khi có món lạc nhóm
function useChipGroups(index: CategoryIndex, counts: Map<string, number>) {
  const { t, i18n } = useTranslation();
  const groups = index.ordered.filter((c) => c.active || counts.has(c.id)).map((c) => ({ id: c.id, label: categoryLabel(c, i18n.language) }));
  if (counts.has(NO_GROUP)) groups.push({ id: NO_GROUP, label: t('catalog.page.noCategory') });
  return groups;
}

export function CatalogFilterBar(p: Props) {
  const { t } = useTranslation();
  const groups = useChipGroups(p.index, p.counts);
  const label = t('catalog.list.search', { n: p.searchable });
  return (
    <div className="ct-filter">
      <div className="toolbar">
        <SearchBox className="flt-search" value={p.q} onChange={p.onSearch} label={label} placeholder={label} />
        {p.collapse && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={p.collapse.onToggle}>
            {t(p.collapse.all ? 'catalog.list.expandAll' : 'catalog.list.collapseAll')}
          </button>
        )}
        <ViewSwitch value={p.mode} onChange={p.onMode} />
      </div>
      {p.tabCounts && (
        <div className="ct-filter__row">
          <CatalogTabBar value={p.tab} counts={p.tabCounts} onChange={p.onTab} />
          {p.bulk && p.bulk.count > 0 && <CatalogBulkBar tab={p.tab} {...p.bulk} />}
        </div>
      )}
      {p.tabCounts && (
        <GroupChips
          className="flt-chips"
          chipClassName="flt-chip"
          countClassName="flt-cnt num"
          label={t('catalog.page.categoryFilter')}
          allLabel={t('catalog.page.allCategories')}
          groups={groups}
          counts={p.counts}
          total={p.total}
          value={p.group ?? ALL_GROUPS}
          onChange={(id) => p.onGroup(id === ALL_GROUPS ? null : id)}
        />
      )}
    </div>
  );
}
