import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { STOCK_FILTERS, type StockFilter, type StockView } from './stock-rows';

type Patch = Record<string, string | null>;

const parseFilter = (raw: string | null): StockFilter | null => (STOCK_FILTERS.includes(raw as StockFilter) ? (raw as StockFilter) : null);

export function useStockParams() {
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get('filter'));
  const q = params.get('q') ?? '';
  const view = useMemo<StockView>(() => ({ filter, q }), [filter, q]);
  const update = useCallback(
    (patch: Patch, replace = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace },
      ),
    [setParams],
  );
  return {
    view,
    setQ: (next: string) => update({ q: next || null }, true),
    toggleFilter: (f: StockFilter) => update({ filter: filter === f ? null : f }),
    clearFilter: () => update({ filter: null }),
    clearAll: () => update({ filter: null, q: null }),
  };
}
