import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { BacklogBy, BacklogGroup as Group, BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';

export type LineAction = 'deliver' | 'cancel' | 'history';

interface Props {
  group: Group;
  by: BacklogBy;
  onAction: (action: LineAction, line: BacklogLine) => void;
}

const isLeft = (l: BacklogLine) => l.user_status !== 'active';

function LeftTag() {
  const { t } = useTranslation();
  return <span className="tag tag--warn">{t('delivery.backlog.left')}</span>;
}

function GroupHead({ group, by, titleId }: { group: Group; by: BacklogBy; titleId: string }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const first = group.lines[0];
  if (by === 'person') {
    return (
      <header className="bl-head">
        <h2 id={titleId}>{f.person(first)}</h2>
        <small>{group.label.department ?? t('delivery.noDepartment')}</small>
        {isLeft(first) && <LeftTag />}
      </header>
    );
  }
  return (
    <header className="bl-head">
      <h2 id={titleId}>{f.name(first)}</h2>
      <b className="bl-owed">{t('delivery.backlog.groupRemaining', { n: group.remaining_qty, unit: f.unit(first.unit) })}</b>
      {first.stock_qty !== null && <small>{t('delivery.backlog.stock', { n: first.stock_qty })}</small>}
    </header>
  );
}

function LineRow({ line, by, onAction }: { line: BacklogLine; by: BacklogBy; onAction: Props['onAction'] }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const outOfStock = line.stock_qty === 0;
  return (
    <li className="bl-line">
      <div className="bl-line-main">
        <small className="bl-month">{f.month(line.period_ym)}</small>
        {by === 'item' ? (
          <span className="bl-who">
            <span>{f.person(line)}</span>
            {isLeft(line) && <LeftTag />}
          </span>
        ) : (
          <span className="bl-who">
            <span>{f.name(line)}</span> <small className="dl-unit">· {f.unit(line.unit)}</small>
          </span>
        )}
        <small className="dl-progress">
          <span>{t('delivery.line.progress', { done: line.delivered_qty, total: line.qty })}</span>
          {line.cancelled_qty > 0 && <span>{t('delivery.line.cancelled', { n: line.cancelled_qty })}</span>}
          <b>{t('delivery.line.remaining', { n: line.remaining_qty })}</b>
        </small>
      </div>
      <div className="bl-actions">
        {outOfStock && <span className="tag">{t('delivery.backlog.outOfStock')}</span>}
        <button type="button" className="btn btn--sm btn--primary" disabled={outOfStock} onClick={() => onAction('deliver', line)}>
          {t('delivery.backlog.deliverMore')}
        </button>
        <button type="button" className="btn btn--sm" onClick={() => onAction('history', line)}>
          {t('delivery.backlog.history')}
        </button>
        <button type="button" className="btn btn--sm" onClick={() => onAction('cancel', line)}>
          {t('delivery.backlog.cancel')}
        </button>
      </div>
    </li>
  );
}

export function BacklogGroup({ group, by, onAction }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const f = useBacklogFormat();
  const title = by === 'person' ? f.person(group.lines[0]) : f.name(group.lines[0]);
  return (
    <section className="a-panel bl-group" aria-labelledby={titleId}>
      <GroupHead group={group} by={by} titleId={titleId} />
      <ul className="bl-lines" aria-label={t('delivery.backlog.lines', { name: title })}>
        {group.lines.map((l) => (
          <LineRow key={l.line_id} line={l} by={by} onAction={onAction} />
        ))}
      </ul>
    </section>
  );
}
