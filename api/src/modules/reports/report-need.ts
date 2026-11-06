// BR-15; món ngoài danh mục (tồn null) không trừ tồn
export function needOf(
  requested: number,
  backlogPrev: number,
  stock: number | null,
): number {
  return Math.max(0, requested + backlogPrev - (stock ?? 0));
}

// Số gộp, không trừ tủ: tính được cho cả bản chốt cũ vì hai trường đã có trong JSON
export function wantOf(r: { requested: number; backlog_prev: number }): number {
  return r.requested + r.backlog_prev;
}

// Lệch số: > 0 dư vào kho, < 0 thiếu; hàng ADM còn nợ giao tính là hàng sẽ có
export function diffOf(x: {
  stock: number;
  order: number;
  adm_owed: number;
  need: number;
}): number {
  return x.stock + x.order + x.adm_owed - x.need;
}
