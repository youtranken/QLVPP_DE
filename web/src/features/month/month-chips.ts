import type { PersonRow } from '@/features/summary/summary.api';

export type MonthChip = 'all' | 'noted' | 'undelivered';

export const MONTH_CHIPS: readonly MonthChip[] = ['all', 'noted', 'undelivered'];

type ChipRow = Pick<PersonRow, 'over_max' | 'adjusted' | 'custom_pending' | 'total_qty' | 'delivered_qty' | 'cancelled_qty'>;

export function chipOf(row: ChipRow): { noted: boolean; undelivered: boolean } {
  return {
    noted: row.over_max || row.adjusted || row.custom_pending > 0 || row.total_qty === 0,
    undelivered: row.delivered_qty + row.cancelled_qty < row.total_qty,
  };
}

export function matchesChip(row: ChipRow, chip: MonthChip): boolean {
  if (chip === 'all') return true;
  return chipOf(row)[chip];
}

export function chipCounts(rows: ChipRow[]): Record<MonthChip, number> {
  return { all: rows.length, noted: rows.filter((r) => chipOf(r).noted).length, undelivered: rows.filter((r) => chipOf(r).undelivered).length };
}
