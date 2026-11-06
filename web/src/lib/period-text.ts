import i18n from '@/lib/i18n';
import { formatVnStamp } from '@/lib/format-time';

// Câu khóa sổ duy nhất: ngày của deadline theo giờ VN, không theo giờ máy
export function lockPhrase(deadline: string, lang: 'vi' | 'en'): string {
  return i18n.t('common.lockPhrase', { lng: lang, day: formatVnStamp(deadline).split(' ')[1] });
}

export const langOf = (language: string): 'vi' | 'en' => (language === 'en' ? 'en' : 'vi');
