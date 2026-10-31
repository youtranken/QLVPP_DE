import { useTranslation } from 'react-i18next';
import { Progress } from '@/ui/progress';
import type { PersonRow } from '@/features/summary/summary.api';
import { DeliveryAvatar } from './delivery-avatar';

function RequestButton({ row, selected, leaving, onSelect }: { row: PersonRow; selected: boolean; leaving: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const name = row.full_name ?? row.email ?? row.user_sub;
  const done = row.delivered_qty + row.cancelled_qty;
  return (
    <li>
      <button type="button" className={leaving ? 'dv-req is-done' : 'dv-req'} aria-pressed={selected} onClick={onSelect}>
        <DeliveryAvatar name={name} done={leaving} />
        <span className="dv-req__text">
          <b className="dv-req__name">{name}</b>
          <small className="dv-req__dept">{row.department ?? t('delivery.noDepartment')}</small>
          <Progress done={done} total={row.total_qty} tone="ok" label={t('delivery.list.progress', { done, total: row.total_qty })} />
        </span>
        {leaving && <span className="sr-only">{t('delivery.list.done')}</span>}
      </button>
    </li>
  );
}

export function DeliveryList({
  month,
  rows,
  count,
  showAll,
  selectedId,
  leaving,
  busy,
  more,
  onShowAll,
  onSelect,
}: {
  month: number;
  rows: PersonRow[];
  count: number;
  showAll: boolean;
  selectedId: string | null;
  leaving: ReadonlySet<string>;
  busy: boolean;
  more?: { loading: boolean; onMore: () => void };
  onShowAll: (on: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="dv-list" aria-labelledby="dv-list-title">
      <header className="dv-list__head">
        <h2 id="dv-list-title">{t(showAll ? 'delivery.list.titleAll' : 'delivery.list.title', { month, n: count })}</h2>
        <label className="dv-switch">
          <input type="checkbox" checked={showAll} onChange={(e) => onShowAll(e.target.checked)} />
          {t('delivery.list.showAll')}
        </label>
      </header>
      <ul className="dv-list__rows" aria-label={t('delivery.list.label')} aria-busy={busy}>
        {rows.map((r) => (
          <RequestButton
            key={r.request_id}
            row={r}
            selected={r.request_id === selectedId}
            leaving={leaving.has(r.request_id)}
            onSelect={() => onSelect(r.request_id)}
          />
        ))}
      </ul>
      {more && (
        <button type="button" className="btn btn--ghost dv-more" disabled={more.loading} onClick={more.onMore}>
          {t('delivery.list.more')}
        </button>
      )}
    </section>
  );
}
