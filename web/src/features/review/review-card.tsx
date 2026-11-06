import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitName } from '@/features/units/units.api';
import { useFormatTime } from '@/lib/format-time';
import { Icon } from '@/ui/icon';
import { ItemThumb } from '@/ui/item-thumb';
import type { ReviewBody, ReviewResult, ReviewRow } from './review.api';
import { ReviewActions } from './review-actions';
import { sentOf } from './review-sent';

const BADGE_TONE = { accepted: 'ok', converted: 'info', rejected: 'danger' } as const;

export function ReviewCard({ row, name, onDone, onStale }: {
  row: ReviewRow;
  name: string;
  onDone: (result: ReviewResult, body: ReviewBody) => void;
  onStale: () => void;
}) {
  const { t } = useTranslation();
  const formatTime = useFormatTime();
  const [done, setDone] = useState<ReviewResult | null>(null);
  const titleId = `rv-${row.line_id}`;
  const unit = useUnitName(row.custom_unit);
  const status = done?.line.review_status ?? row.review_status;
  const note = done ? done.line.review_note : row.review_note;
  const who = row.full_name ?? t('review.card.unknownUser');
  const month = Number(row.period_ym.slice(5));

  return (
    <article className="rv-card" aria-labelledby={titleId}>
      <div className="rv-card__img">
        {row.image_file_id ? (
          <ItemThumb fileId={row.image_file_id} alt={t('review.card.imageAlt', { name })} tone="g0" size={120} />
        ) : (
          <span className="rv-card__noimg">
            <Icon name="image" size={32} />
            {t('review.card.noImage')}
          </span>
        )}
      </div>
      <div className="rv-card__main">
        <h2 id={titleId} className="rv-card__name">
          {name}
        </h2>
        <p className="rv-card__qty">
          {t('review.card.qtyPeriod', { qty: row.qty, unit, month, year: row.period_ym.slice(0, 4) })}
        </p>
        {row.custom_note && <p className="rv-card__note">{t('review.card.note', { note: row.custom_note })}</p>}
        <p className="rv-card__meta">
          {t('review.card.who', {
            name: who,
            department: row.department ?? t('review.card.noDepartment'),
            at: formatTime(row.created_at),
          })}
        </p>
        {row.previously_accepted && status === 'pending' && (
          <p className="rv-card__hint">{t('review.card.previouslyAccepted')}</p>
        )}
        {(status === 'accepted' || status === 'converted' || status === 'rejected') && (
          <div className="rv-card__decision">
            <span className={`tag tag--${BADGE_TONE[status]}`}>{t(`review.card.badge.${status}`)}</span>
            <span>{t(`review.card.decision.${status}`, { reason: note?.trim() ?? '' })}</span>
            {done && <em className="rv-card__when">{t('review.card.justNow')}</em>}
          </div>
        )}
        <ReviewActions
          line={{ ...row, id: row.line_id, custom_name: name, review_status: status }}
          context={{ who, month }}
          sent={sentOf(row)}
          hideStatus
          onDone={(result, body) => {
            setDone(result);
            onDone(result, body);
          }}
          onStale={onStale}
        />
      </div>
    </article>
  );
}
