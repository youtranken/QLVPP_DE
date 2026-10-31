import { compareCategories, groupTone, type Tone } from '@/lib/group-tone';
import { matchesSearch } from '@/features/request/request-format';
import type { AdminItem, Category } from './catalog.api';

export const NO_GROUP = 'none';
export const CATALOG_FILTERS = ['low', 'out', 'noimage'] as const;
export type CatalogFilter = (typeof CATALOG_FILTERS)[number];

export type CatalogRow = AdminItem & { group: string; tone: Tone };

export interface CategoryIndex {
  ordered: Category[];
  rank: Map<string, number>;
  tone: Map<string, Tone>;
  byId: Map<string, Category>;
}

export interface CatalogView {
  cat: string | null;
  q: string;
  inactive: boolean;
  filter: CatalogFilter | null;
}

export function indexCategories(categories: Category[]): CategoryIndex {
  const ordered = [...categories].sort(compareCategories);
  return {
    ordered,
    rank: new Map(ordered.map((c, i) => [c.id, i])),
    tone: new Map(ordered.map((c) => [c.id, groupTone(categories, c.id)])),
    byId: new Map(ordered.map((c) => [c.id, c])),
  };
}

// category_id không còn trong danh sách nhóm (nhóm bị xóa, dữ liệu nạp) → "Chưa xếp nhóm", tông g0
export function toRows(items: AdminItem[], index: CategoryIndex): CatalogRow[] {
  const last = index.ordered.length;
  const rows = items.map((item) => {
    const known = item.category_id !== null && index.rank.has(item.category_id);
    return { ...item, group: known ? item.category_id! : NO_GROUP, tone: known ? index.tone.get(item.category_id!)! : 'g0' } as CatalogRow;
  });
  const rankOf = (r: CatalogRow) => (r.group === NO_GROUP ? last : index.rank.get(r.group)!);
  return rows.sort((a, b) => rankOf(a) - rankOf(b) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'));
}

export function catalogStats(items: AdminItem[], categories: Category[]) {
  const active = items.filter((i) => i.active);
  return {
    active: active.length,
    groups: categories.filter((c) => c.active).length,
    low: active.filter((i) => i.stock_state === 'low').length,
    out: active.filter((i) => i.stock_state === 'out').length,
    noImage: active.filter((i) => i.missing_image).length,
    inactive: items.length - active.length,
  };
}

const FILTER_TEST: Record<CatalogFilter, (r: CatalogRow) => boolean> = {
  low: (r) => r.stock_state === 'low',
  out: (r) => r.stock_state === 'out',
  noimage: (r) => r.missing_image,
};

export const byActive = (rows: CatalogRow[], inactive: boolean) => (inactive ? rows : rows.filter((r) => r.active));

export function applyView(rows: CatalogRow[], view: CatalogView): CatalogRow[] {
  const q = view.q.trim();
  return byActive(rows, view.inactive).filter(
    (r) =>
      (!view.cat || r.group === view.cat) &&
      (!view.filter || FILTER_TEST[view.filter](r)) &&
      (!q || [r.name, r.name_en, r.code, r.pack_note].some((text) => text !== null && matchesSearch(text, q))),
  );
}

export function groupCounts(rows: CatalogRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);
  return counts;
}
