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
