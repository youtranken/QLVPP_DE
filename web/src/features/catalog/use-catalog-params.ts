import { useMemo } from 'react';
import { CATALOG_FILTERS, type CatalogFilter, type CatalogView } from './catalog-rows';
import { useUrlPatch } from '@/lib/use-url-patch';

const parseFilter = (raw: string | null): CatalogFilter | null =>
  CATALOG_FILTERS.includes(raw as CatalogFilter) ? (raw as CatalogFilter) : null;

export function useCatalogParams() {
  const [params, update] = useUrlPatch();
  const cat = params.get('cat') || null;
  const q = params.get('q') ?? '';
  const inactive = params.get('inactive') === '1';
  const filter = parseFilter(params.get('filter'));
  const view = useMemo<CatalogView>(() => ({ cat, q, inactive, filter }), [cat, q, inactive, filter]);


  return {
    view,
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
