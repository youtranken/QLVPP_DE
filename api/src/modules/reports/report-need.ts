// BR-15; món ngoài danh mục (tồn null) không trừ tồn
export function needOf(
  requested: number,
  backlogPrev: number,
  stock: number | null,
): number {
  return Math.max(0, requested + backlogPrev - (stock ?? 0));
}
