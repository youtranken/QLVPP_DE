import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { YM } from '@/lib/ym';

export type SummaryView = 'person' | 'item';
export type PersonFilter = 'unregistered' | 'pending_delivery' | 'custom_pending';
export type PageFilter = PersonFilter | 'low';

const PERSON_FILTERS: readonly string[] = ['unregistered', 'pending_delivery', 'custom_pending'];

type Patch = Record<string, string | null>;

// ?ym= sai mẫu hoặc vượt kỳ đang mở → thay URL bằng kỳ đang mở, không gọi API với tháng sai
export function useSummaryParams(openYm: string | undefined) {
  const [params, setParams] = useSearchParams();
  const asked = params.get('ym');
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : openYm;
  const view: SummaryView = params.get('view') === 'item' ? 'item' : 'person';
  const raw = params.get('filter') ?? '';
  const filter: PageFilter | null = view === 'item' ? (raw === 'low' ? 'low' : null) : PERSON_FILTERS.includes(raw) ? (raw as PersonFilter) : null;

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

  useEffect(() => {
    if (openYm && ym && asked !== null && asked !== ym) update({ ym }, true);
  }, [openYm, ym, asked, update]);

  return {
    ym,
    view,
    filter,
    q: params.get('q') ?? '',
    requestId: params.get('request'),
    setMonth: (next: string) => update({ ym: next, request: null }),
    setView: (next: SummaryView) => update({ view: next === 'item' ? 'item' : null, filter: null }),
    toggleFilter: (next: PageFilter) =>
      update({ view: next === 'low' ? 'item' : null, filter: filter === next ? null : next }),
    clearFilter: () => update({ filter: null }),
    setQ: (next: string) => update({ q: next || null }, true),
    openAdjust: (id: string) => update({ request: id }),
    closeAdjust: () => update({ request: null }),
  };
}
