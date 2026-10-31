import { useMemo } from 'react';
import { parseUsersFilter, type UsersFilter, type UsersView } from './users-rows';
import { useUrlPatch } from '@/lib/use-url-patch';

export function useUsersParams() {
  const [params, update] = useUrlPatch();
  const filter = parseUsersFilter(params.get('status'));
  const dept = params.get('dept') ?? '';
  const q = params.get('q') ?? '';
  const view = useMemo<UsersView>(() => ({ filter, dept, q }), [filter, dept, q]);
  return {
    view,
    setQ: (next: string) => update({ q: next || null }, true),
    setDept: (next: string) => update({ dept: next || null }, true),
    toggleFilter: (f: UsersFilter) => update({ status: filter === f ? null : f }),
    clearFilter: () => update({ status: null }),
    clearAll: () => update({ status: null, dept: null, q: null }),
  };
}
