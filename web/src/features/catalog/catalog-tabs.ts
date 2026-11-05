import type { CatalogRow } from './catalog-rows';

export const CATALOG_TABS = ['active', 'low', 'noImage', 'inactive'] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number];

// stock_state do server tính (như stock-rows.ts): "sắp hết" gồm cả "hết"
const isLowOrOut = (r: CatalogRow) => r.stock_state === 'low' || r.stock_state === 'out';

const TEST: Record<CatalogTab, (r: CatalogRow) => boolean> = {
  active: (r) => r.active,
  low: (r) => r.active && isLowOrOut(r),
  noImage: (r) => r.active && r.missing_image,
  inactive: (r) => !r.active,
};

export const inTab = (row: CatalogRow, tab: CatalogTab): boolean => TEST[tab](row);

export const parseTab = (raw: string | null): CatalogTab => (CATALOG_TABS.includes(raw as CatalogTab) ? (raw as CatalogTab) : 'active');

export function tabCounts(rows: CatalogRow[]): Record<CatalogTab, number> {
  return Object.fromEntries(CATALOG_TABS.map((t) => [t, rows.filter((r) => inTab(r, t)).length])) as Record<CatalogTab, number>;
}

export type CatalogViewMode = 'grid' | 'table';
