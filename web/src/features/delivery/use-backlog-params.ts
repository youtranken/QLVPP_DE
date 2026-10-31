import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BACKLOG_BY, parseBy, type BacklogBy } from './backlog.api';
import { parseFilter, type BacklogFilter } from './backlog-rows';

export function useBacklogParams() {
  const [params, setParams] = useSearchParams();
  const by = parseBy(params.get('by'));
  const filter = parseFilter(params.get('filter'));

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      }),
    [setParams],
  );

  return {
    by,
    filter,
    setBy: (next: BacklogBy) => update({ by: BACKLOG_BY.includes(next) && next !== 'item' ? next : null }),
    toggleFilter: (next: BacklogFilter) => update({ filter: filter === next ? null : next }),
    clearFilter: () => update({ filter: null }),
  };
}
