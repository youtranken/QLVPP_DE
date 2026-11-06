// Bản sao web của api/modules/reports/report-need.ts + order-default.ts; test chéo bằng report-qty.cases.json
export interface QtyRow {
  requested: number;
  backlog_prev: number;
  adm_owed?: number;
  left_excluded?: number;
  usable?: boolean;
}

export function wantOf(r: Pick<QtyRow, 'requested' | 'backlog_prev'>): number {
  return r.requested + r.backlog_prev;
}

// Phần của người đã nghỉ không tính là cần
export function activeNeed(r: QtyRow): number {
  return wantOf(r) - (r.left_excluded ?? 0);
}

// Bản chốt cũ thiếu trường mới → đọc như số gộp
export function defaultOrder(r: QtyRow): number {
  return (r.usable ?? true) ? Math.max(0, activeNeed(r) - (r.adm_owed ?? 0)) : 0;
}

// > 0 dư vào kho, < 0 thiếu; hàng ADM còn nợ giao tính là hàng sẽ có
export function diffOf(x: { stock: number; order: number; adm_owed: number; need: number }): number {
  return x.stock + x.order + x.adm_owed - x.need;
}
