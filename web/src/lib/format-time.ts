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
