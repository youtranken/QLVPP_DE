// Cùng mẫu với api/src/common/ym.ts: năm ≥ 2000, tháng 01–12
export const YM = /^[2-9]\d{3}-(0[1-9]|1[0-2])$/;

export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const at = y * 12 + (m - 1) + delta;
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
}

// Tháng lịch hiện tại theo giờ Việt Nam (UTC+7, không DST). Khác "kỳ đăng ký" (sau ngày chốt là tháng sau).
export function vnYmNow(now: Date = new Date()): string {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
}
