// Số hàng theo nhóm, theo thứ tự gặp đầu tiên; nhóm `last` (chưa xếp nhóm) luôn đứng cuối
export function groupCounts<T>(rows: readonly T[], keyOf: (r: T) => string, last?: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const tail = last !== undefined ? counts.get(last) : undefined;
  if (tail !== undefined && last !== undefined) {
    counts.delete(last);
    counts.set(last, tail);
  }
  return counts;
}
