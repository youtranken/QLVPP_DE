import { useMemo } from 'react';
import { CATALOG_FILTERS, type CatalogFilter, type CatalogView } from './catalog-rows';
import { useUrlPatch } from '@/lib/use-url-patch';
import { parseTab, type CatalogTab, type CatalogViewMode } from './catalog-tabs';

const parseFilter = (raw: string | null): CatalogFilter | null =>
  CATALOG_FILTERS.includes(raw as CatalogFilter) ? (raw as CatalogFilter) : null;

export function useCatalogParams() {
  const [params, update] = useUrlPatch();
  const cat = params.get('cat') || null;
  const q = params.get('q') ?? '';
  const inactive = params.get('inactive') === '1';
  const filter = parseFilter(params.get('filter'));
  const mode: CatalogViewMode = params.get('view') === 'table' ? 'table' : 'grid';
  const tab = parseTab(params.get('tab'));
  const view = useMemo<CatalogView>(() => ({ cat, q, inactive, filter }), [cat, q, inactive, filter]);

  return {
    view,
    mode,
    tab,
    setMode: (next: CatalogViewMode) => update({ view: next === 'table' ? 'table' : null }),
    setTab: (next: CatalogTab) => update({ tab: next === 'active' ? null : next }),
    itemId: params.get('item'),
    itemCategoryId: params.get('itemCat'),
    setCat: (next: string | null) => update({ cat: next }),
    setQ: (next: string) => update({ q: next || null }, true),
    toggleInactive: () => update({ inactive: inactive ? null : '1' }),
    toggleFilter: (f: CatalogFilter) => update({ filter: filter === f ? null : f }),
    clearFilter: () => update({ filter: null }),
    clearAll: () => update({ filter: null, cat: null, q: null }),
    openItemDrawer: (itemId: string | 'new', categoryId?: string) => update({ item: itemId, itemCat: categoryId ?? null }),
    closeItemDrawer: () => update({ item: null, itemCat: null }),
  };
}
