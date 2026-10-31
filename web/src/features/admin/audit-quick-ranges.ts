export interface DayRange {
  from: string;
  to: string;
}

const ZONE = 'Asia/Ho_Chi_Minh';
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE });

// Ngày lịch theo giờ VN dù máy người xem ở múi giờ khác
export function vnDayKey(d: Date): string {
  return DAY_KEY.format(d);
}

function shiftDay(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function quickRanges(now: Date) {
  const today = vnDayKey(now);
  const [year, month] = today.split('-').map(Number);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = shiftDay(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`, -1);
  return {
    today: { from: today, to: today },
    week: { from: shiftDay(today, -6), to: today },
    month: { from: first, to: last, month, year },
  };
}

// Server cũng chặn to < from (400); kiểm trước để lỗi gắn đúng ô, không gọi API
export function dateRangeInvalid(from: string, to: string): boolean {
  return from !== '' && to !== '' && to < from;
}
