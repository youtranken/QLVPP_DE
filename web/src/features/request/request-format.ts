import { useTranslation } from 'react-i18next';
import { useUnitNames } from '@/features/units/units.api';
import { useMe } from '@/lib/me';
import type { LineView } from './request.api';
import type { CartLabel } from './use-cart';

// Dòng bị từ chối/còn chờ xem không giao nên không tính vào a/b hay nợ
export const counted = (l: LineView) => ['n/a', 'accepted', 'converted'].includes(l.review_status);

// Phần còn chờ giao của một dòng (bản web của REMAINING_QTY phía api)
export const owedQty = (l: Pick<LineView, 'qty' | 'delivered_qty' | 'cancelled_qty'>) => l.qty - l.delivered_qty - l.cancelled_qty;

// Tên theo ngôn ngữ giao diện: en dùng name_en khi có
export const nameIn = (l: Pick<CartLabel, 'name' | 'name_en'>, lang: string) => (lang === 'en' && l.name_en ? l.name_en : l.name);

export const monthOf = (ym: string) => Number(ym.slice(5, 7));

const ZONE = 'Asia/Ho_Chi_Minh';
const formatters = new Map<string, { time: Intl.DateTimeFormat; day: Intl.DateTimeFormat }>();

// Hook gọi mỗi dòng giỏ/bảng: dựng Intl.DateTimeFormat một lần cho mỗi locale
function formattersFor(locale: string) {
  let f = formatters.get(locale);
  if (!f) {
    f = {
      time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONE }),
      day: new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: ZONE }),
    };
    formatters.set(locale, f);
  }
  return f;
}

// Hạn là mốc 00:00 ngày sau ngày cuối → lùi 1 ms để ra đúng ngày cuối theo giờ VN
export function useRequestFormat() {
  const { i18n } = useTranslation();
  const unitName = useUnitNames();
  const { time, day } = formattersFor(i18n.language === 'en' ? 'en-GB' : 'vi-VN');
  return {
    time: (iso: string) => time.format(new Date(iso)),
    lastDay: (deadline: string) => {
      const parts = day.formatToParts(new Date(new Date(deadline).getTime() - 1));
      const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      return `${part('day')}/${part('month')}`;
    },
    unit: (code: string | null) => unitName(code),
    name: (l: Pick<CartLabel, 'name' | 'name_en'>) => nameIn(l, i18n.language),
  };
}

// Tên/cách liên hệ Hành chính lấy từ Cấu hình (_SPEC), chưa đặt thì gọi chung "Hành chính"
export function useAdminContact(): string {
  const { t } = useTranslation();
  return useMe().config.admin_contact.trim() || t('request.contactFallback');
}

export function matchesSearch(text: string, query: string): boolean {
  const fold = (s: string) =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase();
  return fold(text).includes(fold(query.trim()));
}
