import type { BacklogGroup, BacklogLine } from './backlog.api';

export type BacklogFilter = 'available' | 'left';

export interface BacklogRow extends BacklogLine {
  id: string;
  group: string;
  // Tiêu đề nhóm theo người dùng phòng ban hiện tại của người đó, không phải phòng ban chụp trên phiếu
  groupDepartment: string | null;
}

export const parseFilter = (v: string | null): BacklogFilter | null => (v === 'available' || v === 'left' ? v : null);

export const isLeft = (l: Pick<BacklogLine, 'user_status'>) => l.user_status !== 'active';

// Dòng ngoài danh mục không có tồn (null) nên luôn giao bổ sung được
export const hasStock = (l: Pick<BacklogLine, 'stock_qty'>) => l.stock_qty !== 0;

const MATCH: Record<BacklogFilter, (l: BacklogLine) => boolean> = { available: hasStock, left: isLeft };

export const flatten = (groups: BacklogGroup[]): BacklogRow[] =>
  groups.flatMap((g) => g.lines.map((l) => ({ ...l, id: l.line_id, group: g.key, groupDepartment: g.label.department ?? null })));

export const applyFilter = (rows: BacklogRow[], filter: BacklogFilter | null) => (filter ? rows.filter(MATCH[filter]) : rows);

export function backlogStats(rows: BacklogLine[]) {
  return {
    owed: rows.reduce((n, l) => n + l.remaining_qty, 0),
    lines: rows.length,
    people: new Set(rows.map((l) => l.user_sub)).size,
    available: rows.filter(hasStock).length,
    left: rows.filter(isLeft).length,
  };
}
