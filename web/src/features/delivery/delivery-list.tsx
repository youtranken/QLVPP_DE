import { useTranslation } from 'react-i18next';
import { Progress } from '@/ui/progress';
import { Segmented } from '@/ui/segmented';
import type { PersonRow } from '@/features/summary/summary.api';
import { DeliveryAvatar } from './delivery-avatar';

function RequestButton({ row, selected, leaving, phone, onSelect }: { row: PersonRow; selected: boolean; leaving: boolean; phone: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const name = row.full_name ?? row.email ?? row.user_sub;
  const done = row.delivered_qty + row.cancelled_qty;
  return (
    <li>
      <button
        type="button"
        className={leaving ? 'dv-req is-done' : 'dv-req'}
        aria-pressed={phone ? undefined : selected}
        aria-label={phone ? t('delivery.list.open', { name, done, total: row.total_qty }) : undefined}
        onClick={onSelect}
      >
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
  counts,
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
  // Có ở điện thoại: bộ lọc thành segmented kèm số phiếu mỗi bên
  counts?: { pending?: number; all?: number };
  showAll: boolean;
  selectedId: string | null;
  leaving: ReadonlySet<string>;
  busy: boolean;
  more?: { loading: boolean; onMore: () => void };
  onShowAll: (on: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const filter: 'pending' | 'all' = showAll ? 'all' : 'pending';
  return (
    <section className="dv-list" aria-labelledby="dv-list-title">
      <header className="dv-list__head">
        <h2 id="dv-list-title">{t(showAll ? 'delivery.list.titleAll' : 'delivery.list.title', { month, n: count })}</h2>
        {counts ? (
          <Segmented
            label={t('delivery.list.filter')}
            value={filter}
            options={[
              { value: 'pending', label: t('delivery.list.pending'), count: counts.pending },
              { value: 'all', label: t('delivery.list.all'), count: counts.all },
            ]}
            onChange={(v) => onShowAll(v === 'all')}
          />
        ) : (
          <label className="dv-switch">
            <input type="checkbox" checked={showAll} onChange={(e) => onShowAll(e.target.checked)} />
            {t('delivery.list.showAll')}
          </label>
        )}
      </header>
      <ul className="dv-list__rows" aria-label={t('delivery.list.label')} aria-busy={busy}>
        {rows.map((r) => (
          <RequestButton
            key={r.request_id}
            row={r}
            selected={r.request_id === selectedId}
            leaving={leaving.has(r.request_id)}
            phone={!!counts}
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
