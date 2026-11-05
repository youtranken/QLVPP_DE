import { useMemo } from 'react';
import { STOCK_FILTERS, type StockFilter, type StockView } from './stock-rows';
import { useUrlPatch } from '@/lib/use-url-patch';
import { YM } from '@/lib/ym';

const parseFilter = (raw: string | null): StockFilter | null => (STOCK_FILTERS.includes(raw as StockFilter) ? (raw as StockFilter) : null);

export type StockTab = 'stock' | 'issues';

export function useStockParams() {
  const [params, update] = useUrlPatch();
  const tab: StockTab = params.get('tab') === 'issues' ? 'issues' : 'stock';
  const rawYm = params.get('ym') ?? '';
  const ym = YM.test(rawYm) ? rawYm : undefined;
  const filter = parseFilter(params.get('filter'));
  const q = params.get('q') ?? '';
  const view = useMemo<StockView>(() => ({ filter, q }), [filter, q]);
  return {
    tab,
    ym,
    setTab: (next: StockTab) => update({ tab: next === 'issues' ? 'issues' : null, ym: null }),
    setYm: (next: string) => update({ ym: next }),
    view,
    setQ: (next: string) => update({ q: next || null }, true),
    toggleFilter: (f: StockFilter) => update({ filter: filter === f ? null : f }),
    clearFilter: () => update({ filter: null }),
    clearAll: () => update({ filter: null, q: null }),
  };
}

export type StockParams = ReturnType<typeof useStockParams>;
