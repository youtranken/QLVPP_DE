import { useMemo } from 'react';
import { usePersonRows, type PersonRow } from './summary.api';
import type { PersonFilter } from './use-summary-params';

export type PersonTableRow = PersonRow & { id: string };
export type PersonTableFilter = Exclude<PersonFilter, 'unregistered'> | null;

// API xếp phòng ban rồi tên; gom "Chưa có phòng ban" xuống cuối cả khi nó tới trước — cũng là thứ tự ↑/↓ của panel
export function usePersonTableRows(ym: string | undefined, filter: PersonTableFilter, q: string) {
  const query = usePersonRows(ym, filter ?? 'all', q);
  const rows = useMemo<PersonTableRow[]>(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.items).map((r) => ({ ...r, id: r.request_id }));
    return [...all.filter((r) => r.department), ...all.filter((r) => !r.department)];
  }, [query.data]);
  return { query, rows };
}

// Thứ tự ↑/↓ của panel phiếu = thứ tự đang hiện trong bảng; chỉ tải khi panel đang mở
export function useRequestOrder(ym: string | undefined, filter: PersonTableFilter, q: string, enabled: boolean) {
  const { rows } = usePersonTableRows(enabled ? ym : undefined, filter, q);
  return useMemo(() => rows.map((r) => r.request_id), [rows]);
}
