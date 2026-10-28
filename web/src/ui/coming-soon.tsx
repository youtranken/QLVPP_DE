import { useTranslation } from 'react-i18next';
import { IconClock } from '@/ui/icons';

export function ComingSoon({ title, asPageTitle = false }: { title: string; asPageTitle?: boolean }) {
  const { t } = useTranslation();
  const Heading = asPageTitle ? 'h1' : 'h2';
  return (
    <section className="soon">
      <span className="soon-ic">
        <IconClock />
      </span>
      <Heading className="soon-title">{title}</Heading>
      <span className="tag tag--brand">{t('common.comingSoon')}</span>
      <p className="soon-hint">{t('common.comingSoonHint')}</p>
    </section>
  );
}
