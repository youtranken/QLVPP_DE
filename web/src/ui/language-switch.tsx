import { useTranslation } from 'react-i18next';
import { setLanguage, type Lang } from '@/lib/i18n';

const LANGS: Lang[] = ['vi', 'en'];

export function LanguageSwitch({ className = '', short = false }: { className?: string; short?: boolean }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language === 'en' ? 'en' : 'vi';
  return (
    <div role="radiogroup" aria-label={t('common.languages.label')} className={`seg seg--value ${className}`}>
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          aria-checked={current === lang}
          lang={lang}
          // Tên truy cập bắt đầu bằng chữ đang hiện (WCAG 2.5.3): "VI – Tiếng Việt"; bản đầy đủ thì chính chữ hiện là tên
          aria-label={short ? `${t(`common.languages.${lang}Short`)} – ${t(`common.languages.${lang}`)}` : undefined}
          onClick={() => void setLanguage(lang)}
        >
          {t(`common.languages.${lang}${short ? 'Short' : ''}`)}
        </button>
      ))}
    </div>
  );
}
