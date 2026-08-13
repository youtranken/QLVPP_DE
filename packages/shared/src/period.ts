import { REG_WINDOW_END_DAY, REG_WINDOW_START_DAY } from './constants';

/**
 * Kỳ đăng ký ('YYYY-MM') tương ứng một thời điểm.
 * Ngày 1–10 → tháng hiện tại; từ ngày 11 → tính sang tháng sau.
 * Dùng giờ địa phương của tiến trình (container đặt TZ=Asia/Ho_Chi_Minh).
 */
export function periodForDate(d: Date = new Date()): string {
  let year = d.getFullYear();
  let month = d.getMonth(); // 0-based
  if (d.getDate() > REG_WINDOW_END_DAY) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Cửa sổ đăng ký có đang mở cho NHÂN VIÊN không (ngày 1–10). Admin bỏ qua kiểm tra này. */
export function isRegistrationOpen(d: Date = new Date()): boolean {
  const day = d.getDate();
  return day >= REG_WINDOW_START_DAY && day <= REG_WINDOW_END_DAY;
}

/** 'YYYY-MM' → 'Tháng M/YYYY'. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  return `Tháng ${Number(month)}/${year}`;
}
