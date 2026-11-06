import { useEffect, useMemo } from 'react';
import { useUrlPatch, type UrlPatch } from '@/lib/use-url-patch';
import type { CatalogView } from './catalog-rows';
import { parseTab, type CatalogTab, type CatalogViewMode } from './catalog-tabs';

// Liên kết cũ (?cat, ?inactive, ?filter, ?tab=low) đổi sang tham số mới; Sắp hết/Hết hàng đã sang Tủ / Kho nên bị bỏ
function legacyPatch(params: URLSearchParams, rawTab: string | null, tab: CatalogTab): UrlPatch | null {
  const patch: UrlPatch = {};
  if (rawTab !== null && rawTab !== tab) patch.tab = null;
  const cat = params.get('cat');
  if (cat !== null) {
    patch.cat = null;
    if (cat && !params.get('group')) patch.group = cat;
  }
  if (params.has('inactive')) {
    patch.inactive = null;
    if (params.get('inactive') === '1') patch.tab = 'inactive';
  }
  const filter = params.get('filter');
  if (filter !== null) {
    patch.filter = null;
    if (filter === 'noimage') patch.tab = 'noImage';
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

// Một thanh lọc cho cả lưới và bảng: đổi chế độ chỉ đổi ?view, giữ q/group/tab
export function useCatalogParams() {
  const [params, update] = useUrlPatch();
  const group = params.get('group') || null;
  const q = params.get('q') ?? '';
  const mode: CatalogViewMode = params.get('view') === 'table' ? 'table' : 'grid';
  const rawTab = params.get('tab');
  const tab = parseTab(rawTab);
  const view = useMemo<CatalogView>(() => ({ group, q }), [group, q]);
  const legacy = legacyPatch(params, rawTab, tab);
  const legacyKey = legacy ? JSON.stringify(legacy) : null;
  useEffect(() => {
    if (legacyKey) update(JSON.parse(legacyKey) as UrlPatch, true);
  }, [legacyKey, update]);

  return {
    view,
    mode,
    tab,
    narrowed: group !== null || q.trim() !== '',
    itemCategoryId: params.get('itemCat'),
    setMode: (next: CatalogViewMode) => update({ view: next === 'table' ? 'table' : null }),
    setTab: (next: CatalogTab) => update({ tab: next === 'active' ? null : next }),
    setGroup: (next: string | null) => update({ group: next }),
    setQ: (next: string) => update({ q: next || null }, true),
    clearAll: () => update({ group: null, q: null }),
  };
}
