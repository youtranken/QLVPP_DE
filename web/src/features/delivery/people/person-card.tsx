import { useTranslation } from 'react-i18next';
import { initialsOf } from '@/lib/initials';
import { ItemThumb } from '@/ui/item-thumb';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { DeliveryPerson } from './delivery-people.api';
import { cardSummary, isOpenLine } from './people-filter';

const THUMBS = 4;

export function PersonAvatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`pp-avatar${large ? ' pp-avatar--lg' : ''}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

// Bật: "Giao…" (có bước xác nhận); vô hiệu thì nói lý do
function actionLabel(person: DeliveryPerson, canDeliver: boolean, t: (k: string) => string) {
  if (canDeliver) return t('delivery.people.card.action');
  if (person.status === 'done') return t('delivery.people.card.delivered');
  if (!person.lines.some(isOpenLine)) return t('delivery.people.card.waitingReview');
  return t('delivery.people.card.noStock');
}

interface Props {
  person: DeliveryPerson;
  selected: boolean;
  canDeliver: boolean;
  onView: () => void;
  onDeliver: () => void;
}

export function PersonCard({ person, selected, canDeliver, onView, onDeliver }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = person.full_name ?? person.user_sub;
  const open = person.lines.filter(isOpenLine);
  const lines = open.length > 0 ? open : person.lines;
  const debt = person.lines.filter((l) => l.is_debt && l.remaining_qty > 0);
  const months = [...new Set(debt.map((l) => monthOf(l.period_ym)))].join(', ');
  const label = actionLabel(person, canDeliver, t);
  const summary = cardSummary(person);
  const progress = {
    done: lines.reduce((n, l) => n + l.delivered_qty, 0),
    total: lines.reduce((n, l) => n + l.qty - l.cancelled_qty, 0),
  };
  return (
    <article className={`pp-card${selected ? ' is-selected' : ''}`} data-status={person.status}>
      <span className={`pp-chip pp-chip--${person.status}`}>{t(`delivery.people.status.${person.status}`)}</span>
      <div className="pp-card__who">
        <PersonAvatar name={name} />
        <div>
          <h3>{name}</h3>
          <small>{person.department ?? t('delivery.people.card.noDepartment')}</small>
        </div>
      </div>
      <div className="pp-card__thumbs">
        {lines.slice(0, THUMBS).map((l) => (
          <ItemThumb key={l.line_id} fileId={l.image_file_id} alt={fmt.name(l)} tone="g0" size={34} />
        ))}
        {lines.length > THUMBS && <span className="pp-card__more">{t('delivery.people.card.more', { n: lines.length - THUMBS })}</span>}
      </div>
      {summary.n > 0 && <p className="pp-card__sum num">{t('delivery.people.card.summary', summary)}</p>}
      {progress.done > 0 && person.status !== 'done' && <p className="pp-card__progress num">{t('delivery.people.card.progress', progress)}</p>}
      {debt.length > 0 && <p className="pp-card__debt">{t('delivery.people.card.debt', { months, n: debt.length })}</p>}
      <div className="pp-card__actions">
        <button type="button" className="btn pp-card__view" aria-label={t('delivery.people.card.viewLabel', { name })} onClick={onView}>
          {t('delivery.people.card.view')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          aria-label={`${label}, ${name}`}
          disabled={!canDeliver}
          onClick={onDeliver}
        >
          {label}
        </button>
      </div>
    </article>
  );
}
