import { useMemo } from 'react';
import { usePersonRows, type PersonRow } from './summary.api';
import type { PersonFilter } from './use-summary-params';

export type PersonTableRow = PersonRow & { id: string };
export type PersonTableFilter = Exclude<PersonFilter, 'unregistered'> | null;

// API xếp phòng ban rồi tên; gom "Chưa có phòng ban" xuống cuối cả khi nó tới trước — cũng là thứ tự ↑/↓ của ngăn kéo
export function usePersonTableRows(ym: string | undefined, filter: PersonTableFilter, q: string) {
  const query = usePersonRows(ym, filter ?? 'all', q);
  const rows = useMemo<PersonTableRow[]>(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.items).map((r) => ({ ...r, id: r.request_id }));
    return [...all.filter((r) => r.department), ...all.filter((r) => !r.department)];
  }, [query.data]);
  return { query, rows };
}

export function useAdjacentRequests(ym: string | undefined, filter: PersonTableFilter, q: string, current: string | null) {
  const { rows } = usePersonTableRows(current ? ym : undefined, filter, q);
  const at = current ? rows.findIndex((r) => r.request_id === current) : -1;
  if (at < 0) return { prev: undefined, next: undefined };
  return { prev: rows[at - 1]?.request_id, next: rows[at + 1]?.request_id };
}
