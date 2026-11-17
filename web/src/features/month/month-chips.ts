import type { PersonRow } from '@/features/summary/summary.api';

export type MonthChip = 'all' | 'noted' | 'undelivered' | 'pending';

export const MONTH_CHIPS: readonly MonthChip[] = ['all', 'noted', 'undelivered', 'pending'];

type ChipRow = Pick<PersonRow, 'over_max' | 'adjusted' | 'custom_pending' | 'total_qty' | 'delivered_qty' | 'cancelled_qty'>;

// pending: người có món ngoài danh mục chờ duyệt — duyệt trong Xem phiếu
export function chipOf(row: ChipRow): Record<Exclude<MonthChip, 'all'>, boolean> {
  return {
    noted: row.over_max || row.adjusted || row.custom_pending > 0 || row.total_qty === 0,
    undelivered: row.delivered_qty + row.cancelled_qty < row.total_qty,
    pending: row.custom_pending > 0,
  };
}

export function matchesChip(row: ChipRow, chip: MonthChip): boolean {
  if (chip === 'all') return true;
  return chipOf(row)[chip];
}

export function chipCounts(rows: ChipRow[]): Record<MonthChip, number> {
  const count = (c: Exclude<MonthChip, 'all'>) => rows.filter((r) => chipOf(r)[c]).length;
  return { all: rows.length, noted: count('noted'), undelivered: count('undelivered'), pending: count('pending') };
}
