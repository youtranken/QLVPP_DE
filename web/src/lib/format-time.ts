// Giờ nghiệp vụ luôn theo giờ Việt Nam dù máy người xem ở múi giờ khác; thứ tự hh:mm dd/mm/yyyy như nhau ở vi và en.
// Luôn năm 4 số ("09:36 12/11/2026"): dateStyle 'short' của vi-VN ra năm 2 số, lệch với mọi chỗ khác ghi "12/11/2026"
export function useFormatTime() {
  return (iso: string) => formatVnStamp(iso, true);
}

const STAMP_PARTS = { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' } as const;
const STAMP = new Intl.DateTimeFormat('en-GB', STAMP_PARTS);
const STAMP_YEAR = new Intl.DateTimeFormat('en-GB', { ...STAMP_PARTS, year: 'numeric' });

// Ghép từng phần để thứ tự "hh:mm dd/mm" cố định, không theo locale người xem
export function formatVnStamp(iso: string, withYear = false): string {
  const parts = (withYear ? STAMP_YEAR : STAMP).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')} ${part('day')}/${part('month')}${withYear ? `/${part('year')}` : ''}`;
}

const ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric', timeZone: ZONE });
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE });

function dayMonthOf(ms: number): { day: number; month: number } {
  const parts = DAY_MONTH.formatToParts(new Date(ms));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: part('day'), month: part('month') };
}

// Ngày cuối được sửa = ngày trước mốc khóa → lùi 1 ms
export function vnDeadlineDay(deadline: string): number {
  return dayMonthOf(new Date(deadline).getTime() - 1).day;
}

export function vnSavedAt(iso: string, now: Date = new Date()): { today: boolean; time: string; date: string } {
  const at = new Date(iso);
  const [hm, dm] = formatVnStamp(iso).split(' ');
  return { today: DAY_KEY.format(at) === DAY_KEY.format(now), time: hm, date: dm };
}

// "14/11 · 19:18": một cách viết giờ lưu phiếu ở Kỳ tháng, Xem phiếu, Điều chỉnh; theo giờ VN, không đổi thành "hôm nay"
export function vnSavedStamp(iso: string): string {
  const [hm, dm] = formatVnStamp(iso).split(' ');
  return `${dm} · ${hm}`;
}
