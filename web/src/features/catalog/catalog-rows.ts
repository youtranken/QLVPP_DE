import { groupCounts as countGroups } from '@/lib/group-counts';
import { compareCategories, toneAtRank, type Tone } from '@/lib/group-tone';
import { matchesSearch } from '@/lib/search';
import type { AdminItem, Category } from './catalog.api';

export const NO_GROUP = 'none';

export type CatalogRow = AdminItem & { group: string; tone: Tone };

export interface CategoryIndex {
  ordered: Category[];
  rank: Map<string, number>;
  tone: Map<string, Tone>;
  byId: Map<string, Category>;
}

export interface CatalogView {
  group: string | null;
  q: string;
}

export function indexCategories(categories: Category[]): CategoryIndex {
  const ordered = [...categories].sort(compareCategories);
  return {
    ordered,
    rank: new Map(ordered.map((c, i) => [c.id, i])),
    tone: new Map(ordered.map((c, i) => [c.id, toneAtRank(i)])),
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

export function applyView(rows: CatalogRow[], view: CatalogView): CatalogRow[] {
  const q = view.q.trim();
  return rows.filter(
    (r) =>
      (!view.group || r.group === view.group) &&
      (!q || [r.name, r.name_en, r.code, r.pack_note].some((text) => text !== null && matchesSearch(text, q))),
  );
}

export const groupCounts = (rows: CatalogRow[]): Map<string, number> => countGroups(rows, (r) => r.group);
