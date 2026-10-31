import { matchesSearch } from '@/features/request/request-format';
import type { BacklogGroup } from '@/features/delivery/backlog.api';
import type { CatalogRow } from '@/features/catalog/catalog-rows';
import type { StockMovement } from './stock.api';

export const STOCK_FILTERS = ['low', 'out'] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export type StockRow = CatalogRow & { owed: number };

export interface StockView {
  filter: StockFilter | null;
  q: string;
}

export function owedByItem(groups: BacklogGroup[]): Map<string, number> {
  const owed = new Map<string, number>();
  for (const g of groups) {
    const id = g.label.item_id;
    if (id && g.remaining_qty > 0) owed.set(id, (owed.get(id) ?? 0) + g.remaining_qty);
  }
  return owed;
}

export const toStockRows = (rows: CatalogRow[], owed: Map<string, number>): StockRow[] =>
  rows.filter((r) => r.active).map((r) => ({ ...r, owed: owed.get(r.id) ?? 0 }));

export function stockStats(rows: StockRow[]) {
  const owing = rows.filter((r) => r.owed > 0);
  return {
    tracked: rows.length,
    low: rows.filter((r) => r.stock_state === 'low').length,
    out: rows.filter((r) => r.stock_state === 'out').length,
    owedQty: owing.reduce((sum, r) => sum + r.owed, 0),
    owedItems: owing.length,
  };
}

export function applyStockView(rows: StockRow[], { filter, q }: StockView): StockRow[] {
  const query = q.trim();
  return rows.filter((r) => (!filter || r.stock_state === filter) && (!query || matchesSearch(r.name, query)));
}

// Sổ cái xếp mới trước: dòng đầu = tồn hiện tại, dòng sau = tồn trước khi dòng liền trên xảy ra
export function balancesAfter(movements: Pick<StockMovement, 'delta'>[], current: number): number[] {
  const out: number[] = [];
  let balance = current;
  for (const m of movements) {
    out.push(balance);
    balance -= m.delta;
  }
  return out;
}
