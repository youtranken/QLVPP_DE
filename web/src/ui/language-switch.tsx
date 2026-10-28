import { useTranslation } from 'react-i18next';
import { setLanguage, type Lang } from '@/lib/i18n';

const LANGS: Lang[] = ['vi', 'en'];

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language === 'en' ? 'en' : 'vi';
  return (
    <div role="radiogroup" aria-label={t('common.languages.label')} className={`seg ${className}`}>
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          aria-checked={current === lang}
          lang={lang}
          onClick={() => void setLanguage(lang)}
        >
          {t(`common.languages.${lang}`)}
        </button>
      ))}
    </div>
  );
}
