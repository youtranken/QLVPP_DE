import type { Category } from '@/features/catalog/catalog.api';

export const ORDER_STEP = 10;

export function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function moveCategory(list: Category[], index: number, dir: -1 | 1): Category[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// sort_order = vị trí*10; nhóm nào đã đúng số đó thì không gửi, dữ liệu cũ (0,1,2…) được đánh số lại một lần
export function orderPatches(ordered: Category[]): { id: string; sort_order: number }[] {
  return ordered.flatMap((c, i) => (c.sort_order === (i + 1) * ORDER_STEP ? [] : [{ id: c.id, sort_order: (i + 1) * ORDER_STEP }]));
}

export const nextSortOrder = (list: Category[]) => list.reduce((m, c) => Math.max(m, c.sort_order), 0) + ORDER_STEP;
