import { groupCounts as countGroups } from '@/lib/group-counts';
import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import type { MemberItem } from './request.api';
import { matchesSearch } from './request-format';

export interface FilterState {
  q: string;
  group: string | 'all';
}

export const NO_GROUP = 'none';

export const DEFAULT_FILTER: FilterState = { q: '', group: 'all' };

// Đọc bộ lọc từ URL (?q=&g=); giá trị lạ → mặc định. Không có g: đang tìm thì tìm mọi nhóm, ngược lại nhóm mặc định của thiết bị
export function parseFilter(params: URLSearchParams, groupIds: string[], defaultGroup: string | 'all'): FilterState {
  const q = (params.get('q') ?? '').trim();
  const g = params.get('g');
  const fallback = q ? 'all' : defaultGroup;
  const group = g === 'all' || g === NO_GROUP ? g : g && groupIds.includes(g) ? g : fallback;
  return { q, group };
}

const fold = (s: string) => s.trim().toLocaleLowerCase('vi');

// Với nhân viên "Chưa có nhóm" chỉ là "Khác": món không nhóm (hoặc nhóm đã ẩn) gộp vào nhóm mang tên đó nếu có, không thì chip riêng
export function itemGroupOf(categories: Category[], otherNames: string[]): (i: MemberItem) => string {
  const known = new Set(categories.map((c) => c.id));
  const names = new Set(otherNames.map(fold));
  const other = categories.find((c) => names.has(fold(c.name)))?.id ?? NO_GROUP;
  return (i) => (i.category_id != null && known.has(i.category_id) ? i.category_id : other);
}

export function applyFilters(items: MemberItem[], f: FilterState, groupOf: (i: MemberItem) => string): MemberItem[] {
  return items.filter(
    (i) =>
      (f.group === 'all' || groupOf(i) === f.group) &&
      (!f.q.trim() || matchesSearch(`${i.name} ${i.name_en ?? ''} ${i.pack_note ?? ''}`, f.q)),
  );
}

export function groupCounts(items: MemberItem[], categories: Category[], lang: string, otherLabel: string, groupOf: (i: MemberItem) => string) {
  const counts = countGroups(items, groupOf);
  const chips = categories.map((c) => ({ id: c.id, label: categoryLabel(c, lang), n: counts.get(c.id) ?? 0 })).filter((g) => g.n > 0);
  const none = counts.get(NO_GROUP) ?? 0;
  return none > 0 ? [...chips, { id: NO_GROUP, label: otherLabel, n: none }] : chips;
}

// Giá trị khác mặc định mới đưa lên URL; null = xóa khóa
export function filterPatch(f: Partial<FilterState>): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  if ('q' in f) patch.q = f.q?.trim() || null;
  if ('group' in f) patch.g = f.group ?? null;
  return patch;
}

export const CLEAR_PATCH: Record<string, string | null> = { q: null, g: null, sort: null, picked: null };
