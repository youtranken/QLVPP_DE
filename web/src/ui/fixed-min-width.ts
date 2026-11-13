// Hẹp hơn tổng tối thiểu (rem/px đủ, cột % 6rem, cột chữ chính 12rem, cột chọn 2.75rem = vùng bấm 44px) thì bảng cuộn ngang, không ép chữ và nút tràn sang cột bên.
// autoMins: cột chữ chính cần sàn khác 12rem (rem) — ở màn chạm sàn, cột đó chỉ còn đúng sàn của nó
export function fixedMinWidth(widths: (string | undefined)[], selection: boolean, autoMins: (string | undefined)[] = []): number {
  const rem = widths.reduce((sum, w, i) => {
    if (!w) return sum + (parseFloat(autoMins[i] ?? '') || 12);
    const n = parseFloat(w);
    if (w.endsWith('rem')) return sum + n;
    if (w.endsWith('px')) return sum + n / 16;
    return sum + 6;
  }, selection ? 2.75 : 0);
  return Math.ceil(rem * 2) / 2;
}
