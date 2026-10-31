import { useMemo } from 'react';
import { STOCK_FILTERS, type StockFilter, type StockView } from './stock-rows';
import { useUrlPatch } from '@/lib/use-url-patch';

const parseFilter = (raw: string | null): StockFilter | null => (STOCK_FILTERS.includes(raw as StockFilter) ? (raw as StockFilter) : null);

export function useStockParams() {
  const [params, update] = useUrlPatch();
  const filter = parseFilter(params.get('filter'));
  const q = params.get('q') ?? '';
  const view = useMemo<StockView>(() => ({ filter, q }), [filter, q]);
  return {
    view,
    setQ: (next: string) => update({ q: next || null }, true),
    toggleFilter: (f: StockFilter) => update({ filter: filter === f ? null : f }),
    clearFilter: () => update({ filter: null }),
    clearAll: () => update({ filter: null, q: null }),
  };
}
