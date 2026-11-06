import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import type { MemberItem } from './request.api';
import { matchesSearch } from './request-format';
import type { CartLine } from './use-cart';

export type SortKey = 'fav' | 'az' | 'group';
export interface FilterState {
  q: string;
  group: string | 'all';
  sort: SortKey;
  onlyPicked: boolean;
}

export const DEFAULT_FILTER: FilterState = { q: '', group: 'all', sort: 'group', onlyPicked: false };

const SORTS: SortKey[] = ['fav', 'az', 'group'];

const nameOf = (i: MemberItem, lang: string) => (lang === 'en' && i.name_en ? i.name_en : i.name);

// Đọc bộ lọc từ URL (?q=&g=&sort=&picked=1); giá trị lạ → mặc định.
// Không có g: đang tìm hoặc lọc "Đã chọn" thì tìm trên mọi nhóm, ngược lại dùng nhóm mặc định của thiết bị (R-C2)
export function parseFilter(params: URLSearchParams, groupIds: string[], defaultGroup: string | 'all'): FilterState {
  const q = (params.get('q') ?? '').trim();
  const sortRaw = params.get('sort') as SortKey | null;
  const sort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : DEFAULT_FILTER.sort;
  const onlyPicked = params.get('picked') === '1';
  const g = params.get('g');
  const fallback = q || onlyPicked ? 'all' : defaultGroup;
  const group = g === 'all' ? 'all' : g && groupIds.includes(g) ? g : fallback;
  return { q, group, sort, onlyPicked };
}

export function applyFilters(
  items: MemberItem[],
  cart: { lines: Pick<CartLine, 'key'>[] },
  f: FilterState,
  lang: string,
  favIds?: ReadonlySet<string>,
): MemberItem[] {
  const picked = new Set(cart.lines.map((l) => l.key));
  const out = items.filter(
    (i) =>
      (f.group === 'all' || i.category_id === f.group) &&
      (!f.onlyPicked || picked.has(i.id)) &&
      (!f.q.trim() || matchesSearch(`${i.name} ${i.name_en ?? ''} ${i.pack_note ?? ''}`, f.q)),
  );
  if (f.sort === 'az') return out.sort((a, b) => nameOf(a, lang).localeCompare(nameOf(b, lang), 'vi'));
  if (f.sort === 'fav' && favIds && favIds.size > 0) {
    // sort ổn định: món hay dùng lên trước, giữ thứ tự API trong mỗi nửa
    return out.sort((a, b) => Number(favIds.has(b.id)) - Number(favIds.has(a.id)));
  }
  return out;
}

export function groupCounts(items: MemberItem[], categories: Category[], lang: string) {
  return categories
    .map((c) => ({ id: c.id, label: categoryLabel(c, lang), n: items.filter((i) => i.category_id === c.id).length }))
    .filter((g) => g.n > 0);
}

// Giá trị khác mặc định mới đưa lên URL; null = xóa khóa
export function filterPatch(f: Partial<FilterState>): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  if ('q' in f) patch.q = f.q?.trim() || null;
  if ('group' in f) patch.g = f.group ?? null;
  if ('sort' in f) patch.sort = f.sort && f.sort !== 'group' ? f.sort : null;
  if ('onlyPicked' in f) patch.picked = f.onlyPicked ? '1' : null;
  return patch;
}

export const CLEAR_PATCH: Record<string, string | null> = { q: null, g: null, sort: null, picked: null };
