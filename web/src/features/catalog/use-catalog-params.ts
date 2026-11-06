import { useEffect, useMemo } from 'react';
import { useUrlPatch } from '@/lib/use-url-patch';
import type { CatalogView } from './catalog-rows';
import { parseTab, type CatalogTab, type CatalogViewMode } from './catalog-tabs';

// Một thanh lọc cho cả lưới và bảng: đổi chế độ chỉ đổi ?view, giữ q/group/tab
export function useCatalogParams() {
  const [params, update] = useUrlPatch();
  const group = params.get('group') || null;
  const q = params.get('q') ?? '';
  const mode: CatalogViewMode = params.get('view') === 'table' ? 'table' : 'grid';
  const rawTab = params.get('tab');
  const tab = parseTab(rawTab);
  const view = useMemo<CatalogView>(() => ({ group, q }), [group, q]);
  // Tab "Sắp hết/hết" đã bỏ: liên kết cũ về tab Đang dùng, không để lại mục lịch sử
  const legacyTab = rawTab !== null && rawTab !== tab;
  useEffect(() => {
    if (legacyTab) update({ tab: null }, true);
  }, [legacyTab, update]);

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
