import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { TONE_COUNT, toneAtRank } from '@/lib/group-tone';
import { categoryLabel, type Category } from './catalog.api';

export function CategoryPreview({ ordered }: { ordered: Category[] }) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const tones = Array.from({ length: TONE_COUNT }, (_, i) => toneAtRank(i));
  return (
    <aside className="cg-preview">
      <section className="cg-preview__card" aria-labelledby={titleId}>
        <h2 id={titleId} className="cg-preview__title">
          {t('catalog.categories.previewTitle')}
        </h2>
        <ul className="ct-chips cg-preview__chips">
          {ordered.map((c, i) =>
            c.active ? (
              <li key={c.id} className="ct-chip cg-preview__chip">
                <span className="ct-dot" style={{ background: `var(--${toneAtRank(i)}-ink)` }} aria-hidden="true" />
                {categoryLabel(c, i18n.language)}
              </li>
            ) : null,
          )}
        </ul>
      </section>
      <section className="cg-preview__card">
        <h2 className="cg-preview__title">{t('catalog.categories.tonesTitle')}</h2>
        <ol className="cg-tones" aria-label={t('catalog.categories.tonesTitle')}>
          {tones.map((tone, i) => (
            <li key={tone} className="cg-tone" style={{ background: `var(--${tone})`, color: `var(--${tone}-ink)` }} title={t(`catalog.tones.${tone}`)}>
              <span className="num">{i + 1}</span>
              <span className="sr-only">{t(`catalog.tones.${tone}`)}</span>
            </li>
          ))}
        </ol>
        <p className="cg-preview__note">{t('catalog.categories.tonesNote')}</p>
      </section>
    </aside>
  );
}
