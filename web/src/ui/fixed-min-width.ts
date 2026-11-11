// Hẹp hơn tổng tối thiểu (rem/px đủ, cột % 6rem, cột chữ chính 12rem) thì bảng cuộn ngang, không ép chữ và nút tràn sang cột bên
export function fixedMinWidth(widths: (string | undefined)[], selection: boolean): number {
  const rem = widths.reduce((sum, w) => {
    if (!w) return sum + 12;
    const n = parseFloat(w);
    if (w.endsWith('rem')) return sum + n;
    if (w.endsWith('px')) return sum + n / 16;
    return sum + 6;
  }, selection ? 2.5 : 0);
  return Math.ceil(rem * 2) / 2;
}
