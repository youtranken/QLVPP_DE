import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from '@/locales/vi';
import en from '@/locales/en';

export type Lang = 'vi' | 'en';

// Chỉ lưu ngôn ngữ, không bao giờ lưu token
const LANG_KEY = 'vpp_lang';

export function savedLanguage(): Lang {
  // storage bị chặn (private mode/policy) không được làm trắng trang
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

function applyDocumentLanguage(lang: Lang): void {
  document.documentElement.lang = lang;
  document.title = i18n.t('app.title');
}

export function setLanguage(lang: Lang): Promise<void> {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // không lưu được thì vẫn đổi ngôn ngữ phiên hiện tại
  }
  return i18n.changeLanguage(lang).then(() => applyDocumentLanguage(lang));
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: savedLanguage(),
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
  })
  .then(() => applyDocumentLanguage(savedLanguage()));

export default i18n;
