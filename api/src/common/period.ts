// Luật kỳ thuần; tháng là chuỗi 'YYYY-MM', ngày tính theo lịch VN
const VN_OFFSET_MS = 7 * 3_600_000; // VN không có giờ mùa hè → +07 cố định
const DAY_MS = 86_400_000;

const vnFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface VnDate {
  y: number;
  m: number;
  d: number;
}

export function vnDate(at: Date): VnDate {
  const parts = Object.fromEntries(
    vnFormat.formatToParts(at).map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
  };
}

function toYm(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function splitYm(ym: string): [number, number] {
  const [y, m] = ym.split('-').map(Number);
  return [y, m];
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = splitYm(ym);
  const idx = y * 12 + (m - 1) + n;
  return toYm(Math.floor(idx / 12), (idx % 12) + 1);
}

export function periodFor(now: Date, lastDay: number): string {
  const { y, m, d } = vnDate(now);
  const ym = toYm(y, m);
  return d <= lastDay ? ym : addMonths(ym, 1);
}

export function deadlineOf(ym: string, lastDay: number): Date {
  const [y, m] = splitYm(ym);
  // Date.UTC tự cuộn ngày lastDay+1 sang tháng sau (vd 29/02 → 01/03)
  return new Date(Date.UTC(y, m - 1, lastDay + 1) - VN_OFFSET_MS);
}

function dayNumber({ y, m, d }: VnDate): number {
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function daysLeft(now: Date, deadline: Date): number {
  // Ngày hạn = ngày lịch VN ngay trước mốc deadline (00:00)
  const lastDay = vnDate(new Date(deadline.getTime() - 1));
  return Math.max(0, dayNumber(lastDay) - dayNumber(vnDate(now)) + 1);
}
