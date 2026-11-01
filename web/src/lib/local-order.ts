export const ORDER_STEP = 10;

export interface Ordered {
  sort_order: number;
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// sort_order = vị trí*10; mục nào đã đúng số đó thì không gửi, dữ liệu cũ (0,1,2…) được đánh số lại một lần
export function orderPatches<T extends Ordered>(ordered: T[], keyOf: (item: T) => string): { key: string; sort_order: number }[] {
  return ordered.flatMap((item, i) => (item.sort_order === (i + 1) * ORDER_STEP ? [] : [{ key: keyOf(item), sort_order: (i + 1) * ORDER_STEP }]));
}
