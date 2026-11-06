import { useTranslation } from 'react-i18next';
import { BulkBar } from '@/ui/bulk-bar';
import { ALL_GROUPS, GroupChips } from '@/ui/filter/group-chips';
import { SearchBox } from '@/ui/filter/search-box';
import { categoryLabel } from './catalog.api';
import { NO_GROUP, type CategoryIndex } from './catalog-rows';
import { CatalogTabBar, ViewSwitch } from './catalog-tab-bar';
import type { CatalogTab, CatalogViewMode } from './catalog-tabs';

export interface CatalogBulk {
  count: number;
  pending: boolean;
  onMax: () => void;
  onMove: () => void;
  onDeactivate: () => void;
  onClear: () => void;
}

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

function BulkActions({ bulk }: { bulk: CatalogBulk }) {
  const { t } = useTranslation();
  return (
    <BulkBar count={bulk.count} label={t('catalog.stats.items')} onClear={bulk.onClear}>
      <button type="button" disabled={bulk.pending} onClick={bulk.onMax}>
        {t('catalog.bulk.max')}
      </button>
      <button type="button" disabled={bulk.pending} onClick={bulk.onMove}>
        {t('catalog.bulk.move')}
      </button>
      <button type="button" disabled={bulk.pending} onClick={bulk.onDeactivate}>
        {t('catalog.bulk.deactivate')}
      </button>
    </BulkBar>
  );
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
      {p.bulk && p.bulk.count > 0 ? (
        <BulkActions bulk={p.bulk} />
      ) : (
        <div className="toolbar">
          <SearchBox className="flt-search" value={p.q} onChange={p.onSearch} label={label} placeholder={label} />
          {p.collapse && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={p.collapse.onToggle}>
              {t(p.collapse.all ? 'catalog.list.expandAll' : 'catalog.list.collapseAll')}
            </button>
          )}
          <ViewSwitch value={p.mode} onChange={p.onMode} />
        </div>
      )}
      {p.tabCounts && <CatalogTabBar value={p.tab} counts={p.tabCounts} onChange={p.onTab} />}
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
