import { useMemo } from 'react';
import { DEFAULT_USERS_FILTER, parseRegFilter, parseUsersFilter, type RegFilter, type UsersFilter, type UsersView } from './users-rows';

// Mặc định không ghi lên URL
const statusParam = (f: UsersFilter) => (f === DEFAULT_USERS_FILTER ? null : f);
import { useUrlPatch } from '@/lib/use-url-patch';

export function useUsersParams() {
  const [params, update] = useUrlPatch();
  const filter = parseUsersFilter(params.get('status'));
  const reg = parseRegFilter(params.get('reg'));
  const dept = params.get('dept') ?? '';
  const q = params.get('q') ?? '';
  const view = useMemo<UsersView>(() => ({ filter, reg, dept, q }), [filter, reg, dept, q]);
  return {
    view,
    setQ: (next: string) => update({ q: next || null }, true),
    setDept: (next: string) => update({ dept: next || null }, true),
    setFilter: (next: UsersFilter) => update({ status: statusParam(next) }),
    // Thẻ lọc chỉ chọn một: bật thẻ này thì tắt thẻ kia (hai thẻ cùng bật gần như luôn ra 0 người); bấm lại thẻ đang chọn → Mọi trạng thái
    toggleFilter: (f: UsersFilter) => update({ status: filter === f ? 'all' : statusParam(f), reg: null }),
    toggleReg: (r: RegFilter) => update({ reg: reg === r ? null : r, status: null }),
    clearFilter: () => update({ status: null }),
    clearReg: () => update({ reg: null }),
    clearAll: () => update({ status: null, reg: null, dept: null, q: null }),
  };
}
