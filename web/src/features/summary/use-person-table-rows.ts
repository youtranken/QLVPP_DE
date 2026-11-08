import { useMemo } from 'react';
import { usePersonRows, type PersonRow } from './summary.api';

export type PersonTableRow = PersonRow & { id: string };

// API xếp phòng ban rồi tên; gom "Chưa có phòng ban" xuống cuối cả khi nó tới trước (cũng là thứ tự ↑/↓ của panel)
export function usePersonTableRows(ym: string | undefined, q: string) {
  const query = usePersonRows(ym, 'all', q);
  const rows = useMemo<PersonTableRow[]>(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.items).map((r) => ({ ...r, id: r.request_id }));
    return [...all.filter((r) => r.department), ...all.filter((r) => !r.department)];
  }, [query.data]);
  return { query, rows };
}
