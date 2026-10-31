import { useUrlPatch } from '@/lib/use-url-patch';
import { BACKLOG_BY, parseBy, type BacklogBy } from './backlog.api';
import { parseFilter, type BacklogFilter } from './backlog-rows';

export function useBacklogParams() {
  const [params, update] = useUrlPatch();
  const by = parseBy(params.get('by'));
  const filter = parseFilter(params.get('filter'));


  return {
    by,
    filter,
    setBy: (next: BacklogBy) => update({ by: BACKLOG_BY.includes(next) && next !== 'item' ? next : null }),
    toggleFilter: (next: BacklogFilter) => update({ filter: filter === next ? null : next }),
    clearFilter: () => update({ filter: null }),
  };
}
