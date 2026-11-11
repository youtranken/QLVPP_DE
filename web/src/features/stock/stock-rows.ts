import { matchesSearch } from '@/features/request/request-format';
import type { CatalogRow } from '@/features/catalog/catalog-rows';
import type { StockFacts, StockMovement } from './stock.api';

export const STOCK_FILTERS = ['incoming', 'low', 'none'] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export type StockRow = Omit<CatalogRow, 'stock_state'> & Omit<StockFacts, 'item_id'>;

export interface StockView {
  filter: StockFilter | null;
  q: string;
}

// Món ngừng vẫn hiện khi còn tủ hoặc còn người chờ (cần xuất/giao nốt); món chưa có số tủ của server thì chờ lần tải sau
export const toStockRows = (rows: CatalogRow[], facts: Map<string, StockFacts>): StockRow[] =>
  rows.flatMap((r) => {
    const f = facts.get(r.id);
    if (!f || (!r.usable && f.stock_qty === 0 && f.held === 0)) return [];
    const { item_id: _id, ...rest } = f;
    return [{ ...r, ...rest }];
  });

export type StockStatus = 'paused' | 'incoming' | Exclude<StockRow['stock_state'], 'short' | 'incoming'>;

// Tình trạng hiện ở Tủ/Kho: món tạm ngưng chỉ ghi "Tạm ngưng"; có người chờ phiếu đã chốt mà tủ chưa đủ là "Chờ hàng về"
// (dù hàng NCC đang về có đủ bù hay không — thiếu thật thì tô đỏ ở nhãn)
export function stockViewOf(r: Pick<StockRow, 'usable' | 'stock_state'>): StockStatus {
  if (!r.usable) return 'paused';
  if (r.stock_state === 'short' || r.stock_state === 'incoming') return 'incoming';
  return r.stock_state;
}

export function stockStats(rows: StockRow[]): Record<StockFilter | 'all', number> {
  const count = (state: StockFilter) => rows.filter((r) => stockViewOf(r) === state).length;
  return { all: rows.length, incoming: count('incoming'), low: count('low'), none: count('none') };
}

export const shortCount = (facts: Pick<StockFacts, 'short'>[]): number => facts.filter((f) => f.short > 0).length;

export function applyStockView(rows: StockRow[], { filter, q }: StockView): StockRow[] {
  const query = q.trim();
  return rows.filter((r) => (!filter || stockViewOf(r) === filter) && (!query || matchesSearch(r.name, query)));
}

// Xuất lẻ được lấy phần đang giữ cho người chờ (không chặn): khối cam + đổi nút thành "Vẫn xuất"
export function tookHeldOf(item: Pick<StockRow, 'free' | 'stock_qty'>, qty: number | null): number {
  if (qty === null || qty <= item.free || qty > item.stock_qty) return 0;
  return qty - item.free;
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
