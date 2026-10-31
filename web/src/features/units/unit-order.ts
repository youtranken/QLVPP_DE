import type { AdminUnit } from './units.api';

export const ORDER_STEP = 10;

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const sortUnits = (list: AdminUnit[]): AdminUnit[] =>
  [...list].sort((a, b) => a.sort_order - b.sort_order || byText(a.name.toLowerCase(), b.name.toLowerCase()) || byText(a.code, b.code));

export function moveUnit(list: AdminUnit[], index: number, dir: -1 | 1): AdminUnit[] {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// sort_order = vị trí*10; ĐVT nào đã đúng số đó thì không gửi
export const orderPatches = (ordered: AdminUnit[]): { code: string; sort_order: number }[] =>
  ordered.flatMap((u, i) => (u.sort_order === (i + 1) * ORDER_STEP ? [] : [{ code: u.code, sort_order: (i + 1) * ORDER_STEP }]));

export const nextSortOrder = (list: AdminUnit[]) => list.reduce((m, u) => Math.max(m, u.sort_order), 0) + ORDER_STEP;
