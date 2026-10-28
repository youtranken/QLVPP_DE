import { useTranslation } from 'react-i18next';
import type { Category } from '@/features/catalog/catalog.api';
import { useMe } from '@/lib/me';
import type { CartLabel } from './use-cart';

export const monthOf = (ym: string) => Number(ym.slice(5, 7));

// Tháng 12 → tháng 1 năm sau (không ra "tháng 13")
export function nextYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

// Hạn là mốc 00:00 ngày sau ngày cuối → lùi 1 ms để ra đúng ngày cuối theo giờ VN
export function useRequestFormat() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'vi-VN';
  const zone = 'Asia/Ho_Chi_Minh';
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone });
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: zone });
  return {
    time: (iso: string) => time.format(new Date(iso)),
    lastDay: (deadline: string) => {
      const parts = day.formatToParts(new Date(new Date(deadline).getTime() - 1));
      const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      return `${part('day')}/${part('month')}`;
    },
    unit: (code: string | null) => (code ? t(`catalog.units.${code}`, { defaultValue: code }) : ''),
    name: (l: Pick<CartLabel, 'name' | 'name_en'>) => (i18n.language === 'en' && l.name_en ? l.name_en : l.name),
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

const TINTS = ['t1', 't2', 't3', 't4'];

// Ô ảnh thiếu ảnh tô màu theo nhóm (4 màu nhóm món của _SPEC)
export function tintOf(categoryId: string | null, categories: Category[]): string {
  const at = categories.findIndex((c) => c.id === categoryId);
  return TINTS[(at < 0 ? 0 : at) % TINTS.length];
}
