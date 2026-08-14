import { REG_WINDOW_MAX_DAY, REG_WINDOW_MIN_DAY } from './constants';

/**
 * Khung ngày đăng ký hằng tháng. Admin sửa được ở màn Cài đặt nên đây là **dữ liệu**,
 * không phải hằng số — mọi hàm dưới đây đều nhận khung ngày làm tham số.
 */
export interface RegistrationWindow {
  /** Ngày mở đăng ký (1–31). */
  startDay: number;
  /** Ngày đóng đăng ký (1–31). Đặt 31 nghĩa là "đến hết tháng". */
  endDay: number;
}

/** Khung mặc định khi chưa ai chỉnh: từ ngày 20 đến hết tháng. */
export const DEFAULT_REGISTRATION_WINDOW: RegistrationWindow = { startDay: 20, endDay: 31 };

/** Số ngày thật của tháng chứa `d`. */
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Khung ngày ÁP DỤNG THẬT cho tháng chứa `d`.
 *
 * Tháng dài ngắn khác nhau nên khung phải co lại: đặt ngày cuối là 31 thì tháng 2
 * tự hiểu là 28/29, tháng 4 là 30. Không co thì người dùng tháng 2 mất mất ngày
 * đăng ký cuối cùng mà không hiểu vì sao.
 *
 * Ngày mở cũng co theo, nếu không admin lỡ đặt mở ngày 30 thì tháng 2 cửa sổ
 * **không bao giờ mở** — cả phòng ban mất một kỳ đăng ký.
 */
export function resolveWindow(w: RegistrationWindow, d: Date): { start: number; end: number } {
  const last = daysInMonth(d);
  const end = Math.min(w.endDay, last);
  const start = Math.min(w.startDay, end);
  return { start, end };
}

/**
 * Kỳ đăng ký ('YYYY-MM') tương ứng một thời điểm.
 *
 * Cửa sổ đăng ký phục vụ **tháng kế tiếp**: đăng ký trong ngày 20–31/8 là đăng ký
 * cho tháng 9. Trước khi cửa sổ mở, kỳ đang chạy vẫn là tháng hiện tại (đã đăng ký
 * từ cuối tháng trước).
 *
 * Dùng giờ địa phương của tiến trình (container đặt TZ=Asia/Ho_Chi_Minh).
 */
export function periodForDate(w: RegistrationWindow, d: Date = new Date()): string {
  const { start } = resolveWindow(w, d);
  let year = d.getFullYear();
  let month = d.getMonth(); // 0-based
  if (d.getDate() >= start) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Cửa sổ đăng ký có đang mở cho NHÂN VIÊN không. Admin bỏ qua kiểm tra này. */
export function isRegistrationOpen(w: RegistrationWindow, d: Date = new Date()): boolean {
  const { start, end } = resolveWindow(w, d);
  const day = d.getDate();
  return day >= start && day <= end;
}

/** Khung ngày có hợp lệ không — dùng chung cho form admin và kiểm tra ở server. */
export function checkWindowDays(w: RegistrationWindow): string | null {
  const inRange = (n: number) =>
    Number.isInteger(n) && n >= REG_WINDOW_MIN_DAY && n <= REG_WINDOW_MAX_DAY;
  if (!inRange(w.startDay) || !inRange(w.endDay)) {
    return `Ngày phải là số nguyên từ ${REG_WINDOW_MIN_DAY} đến ${REG_WINDOW_MAX_DAY}.`;
  }
  if (w.startDay > w.endDay) return 'Ngày mở đăng ký phải trước hoặc bằng ngày đóng.';
  return null;
}

/** Mô tả khung ngày cho người đọc: "từ ngày 20 đến hết tháng". */
export function describeWindow(w: RegistrationWindow): string {
  const den = w.endDay >= REG_WINDOW_MAX_DAY ? 'hết tháng' : `ngày ${w.endDay}`;
  return `từ ngày ${w.startDay} đến ${den}`;
}

/** 'YYYY-MM' → 'Tháng M/YYYY'. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  return `Tháng ${Number(month)}/${year}`;
}
