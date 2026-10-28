import type { Category } from '@/features/catalog/catalog.api';

// Đánh số lại 0..n-1 sau khi đổi chỗ: sort_order trùng nhau (dữ liệu cũ) vẫn sắp đúng
export function reorderPatches(list: Category[], index: number, dir: -1 | 1): { id: string; sort_order: number }[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return [];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next.flatMap((c, i) => (c.sort_order === i ? [] : [{ id: c.id, sort_order: i }]));
}
