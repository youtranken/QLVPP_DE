// Cùng mẫu với api/src/common/ym.ts: năm ≥ 2000, tháng 01–12
export const YM = /^[2-9]\d{3}-(0[1-9]|1[0-2])$/;

export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const at = y * 12 + (m - 1) + delta;
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
}
