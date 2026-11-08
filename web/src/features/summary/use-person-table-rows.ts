import { useEffect, useMemo } from 'react';
import { usePersonRows, type PersonRow } from './summary.api';

export type PersonTableRow = PersonRow & { id: string };

// API xếp phòng ban rồi tên; gom "Chưa có phòng ban" xuống cuối cả khi nó tới trước (cũng là thứ tự ↑/↓ của panel)
export function usePersonTableRows(ym: string | undefined, q: string) {
  const query = usePersonRows(ym, 'all', q);
  // Chip, số đếm và bước Giao tính trên cả kỳ: nạp hết các trang (mỗi trang 100 người)
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);
  const rows = useMemo<PersonTableRow[]>(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.items).map((r) => ({ ...r, id: r.request_id }));
    return [...all.filter((r) => r.department), ...all.filter((r) => !r.department)];
  }, [query.data]);
  return { query, rows };
}
