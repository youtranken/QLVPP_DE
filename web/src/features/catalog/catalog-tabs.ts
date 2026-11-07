import type { CatalogRow } from './catalog-rows';

export const CATALOG_TABS = ['all', 'active', 'inactive', 'noImage'] as const;
export type CatalogTab = (typeof CATALOG_TABS)[number];

const TEST: Record<CatalogTab, (r: CatalogRow) => boolean> = {
  all: () => true,
  active: (r) => r.usable,
  inactive: (r) => !r.usable,
  noImage: (r) => r.usable && r.missing_image,
};

export const inTab = (row: CatalogRow, tab: CatalogTab): boolean => TEST[tab](row);

export const parseTab = (raw: string | null): CatalogTab => (CATALOG_TABS.includes(raw as CatalogTab) ? (raw as CatalogTab) : 'all');

export function tabCounts(rows: CatalogRow[]): Record<CatalogTab, number> {
  return Object.fromEntries(CATALOG_TABS.map((t) => [t, rows.filter((r) => inTab(r, t)).length])) as Record<CatalogTab, number>;
}

export type CatalogViewMode = 'grid' | 'table';
