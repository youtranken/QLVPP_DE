import { useTranslation } from 'react-i18next';
import { fileUrl } from '@/features/catalog/catalog.api';
import type { ReviewResult, ReviewRow } from './review.api';
import { ReviewActions } from './review-actions';

export function ReviewCard({ row, name, onDone, onStale }: {
  row: ReviewRow;
  name: string;
  onDone: (result: ReviewResult) => void;
  onStale: () => void;
}) {
  const { t } = useTranslation();
  const titleId = `rv-${row.line_id}`;
  const unit = row.custom_unit ? t(`catalog.units.${row.custom_unit}`) : '';
  return (
    <article className="rv-card" aria-labelledby={titleId}>
      <div className="rv-img">
        {row.image_file_id ? (
          <img src={fileUrl(row.image_file_id)} alt={t('review.card.imageAlt', { name })} loading="lazy" />
        ) : (
          <span>{t('review.card.noImage')}</span>
        )}
      </div>
      <div className="rv-main">
        <h2 id={titleId} className="rv-name">
          {name}
        </h2>
        {row.previously_accepted && <span className="tag tag--brand rv-hint">{t('review.card.previouslyAccepted')}</span>}
        <p className="rv-qty">{t('review.card.qty', { qty: row.qty, unit })}</p>
        {row.custom_note && <p className="rv-note">{t('review.card.note', { note: row.custom_note })}</p>}
        <p className="rv-meta">
          {t('review.card.who', {
            name: row.full_name ?? t('review.card.unknownUser'),
            department: row.department ?? t('review.card.noDepartment'),
          })}
          <span aria-hidden="true"> · </span>
          {t('review.card.period', { month: Number(row.period_ym.slice(5)), year: row.period_ym.slice(0, 4) })}
        </p>
        <ReviewActions
          line={{ ...row, id: row.line_id, custom_name: name }}
          onDone={onDone}
          onStale={onStale}
        />
      </div>
    </article>
  );
}
