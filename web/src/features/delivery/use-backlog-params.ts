import { useUrlPatch } from '@/lib/use-url-patch';
import { BACKLOG_BY, parseBy, type BacklogBy, type CancelReason } from './backlog.api';
import { parseFilter, type BacklogFilter } from './backlog-rows';

export function useBacklogParams() {
  const [params, update] = useUrlPatch();
  const by = parseBy(params.get('by'));
  // ?left=1 đến từ nhắc người đã nghỉ ở Tháng này: lọc người đã nghỉ và Hủy nợ chọn sẵn "Người đã nghỉ"
  const left = params.get('left') === '1';
  const filter = parseFilter(params.get('filter')) ?? (left ? 'left' : null);

  return {
    by,
    filter,
    cancelReason: (left ? 'user_left' : undefined) as CancelReason | undefined,
    setBy: (next: BacklogBy) => update({ by: BACKLOG_BY.includes(next) && next !== 'item' ? next : null }),
    toggleFilter: (next: BacklogFilter) => update({ filter: filter === next ? null : next, left: null }),
    clearFilter: () => update({ filter: null, left: null }),
  };
}
