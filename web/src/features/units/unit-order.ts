import type { AdminUnit } from './units.api';

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Giống thứ tự server: sort_order, rồi tên, rồi mã
export const compareUnits = (a: AdminUnit, b: AdminUnit) =>
  a.sort_order - b.sort_order || byText(a.name.toLowerCase(), b.name.toLowerCase()) || byText(a.code, b.code);
