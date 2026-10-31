import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseUsersFilter, type UsersFilter, type UsersView } from './users-rows';

type Patch = Record<string, string | null>;

export function useUsersParams() {
  const [params, setParams] = useSearchParams();
  const filter = parseUsersFilter(params.get('status'));
  const dept = params.get('dept') ?? '';
  const q = params.get('q') ?? '';
  const view = useMemo<UsersView>(() => ({ filter, dept, q }), [filter, dept, q]);
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
    setDept: (next: string) => update({ dept: next || null }, true),
    toggleFilter: (f: UsersFilter) => update({ status: filter === f ? null : f }),
    clearFilter: () => update({ status: null }),
    clearAll: () => update({ status: null, dept: null, q: null }),
  };
}
