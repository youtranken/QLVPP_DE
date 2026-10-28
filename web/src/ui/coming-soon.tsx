import { useTranslation } from 'react-i18next';
import { IconClock } from '@/ui/icons';

export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <section className="soon">
      <span className="soon-ic">
        <IconClock />
      </span>
      <h2 className="soon-title">{title}</h2>
      <span className="tag tag--brand">{t('common.comingSoon')}</span>
      <p className="soon-hint">{t('common.comingSoonHint')}</p>
    </section>
  );
}
