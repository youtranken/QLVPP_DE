import { useTranslation } from 'react-i18next';

// Giờ nghiệp vụ luôn theo giờ Việt Nam dù máy người xem ở múi giờ khác
export function useFormatTime() {
  const { i18n } = useTranslation();
  const fmt = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return (iso: string) => fmt.format(new Date(iso));
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

// "07/11 11:06": ngày giờ cố định theo giờ VN, không đổi thành "hôm nay"
export function vnSavedStamp(iso: string): string {
  const [hm, dm] = formatVnStamp(iso).split(' ');
  return `${dm} ${hm}`;
}
