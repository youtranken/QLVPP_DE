import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { Segmented } from '@/ui/segmented';
import { diffTone, type DiffTone } from '@/ui/feedback/diff-tone';
import { useRequestFormat } from '@/features/request/request-format';
import type { OrderQty } from '@/features/reports/use-order-qty';
import { OrderCell } from './order-cell';
import { orderDiff } from './order-formula';
import { orderOf, type OrderRow } from './send-adm-rows';

type Filter = 'all' | DiffTone;

export function ItemCell({ row }: { row: OrderRow }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return (
    <td className="sa-item">
      <div className="sa-item__in">
        <ItemThumb fileId={row.image_file_id} alt="" tone="g0" size={36} />
        <span>
          <b>{fmt.name(row)}</b>
          <small>{[row.code, row.custom ? t('sendAdm.orders.outside') : null].filter(Boolean).join(' · ') || fmt.unit(row.unit)}</small>
          {!row.usable && (
            <>
              <span className="tag tag--warn sa-item__tag">{t('warn.W3label')}</span>
              <small>{t('warn.W3')}</small>
            </>
          )}
        </span>
      </div>
    </td>
  );
}

function useTones(rows: OrderRow[], qty: OrderQty) {
  const tones = new Map(rows.map((r) => [r.key, diffTone(orderDiff(r, orderOf(qty, r)))]));
  const count = (tone: DiffTone) => [...tones.values()].filter((x) => x === tone).length;
  return { tones, short: count('short'), surplus: count('surplus'), ok: count('ok') };
}

function Toolbar({ counts, filter, onFilter }: { counts: ReturnType<typeof useTones>; filter: Filter; onFilter: (f: Filter) => void }) {
  const { t } = useTranslation();
  const opts: { value: Filter; label: string; count?: number }[] = [
    { value: 'all', label: t('sendAdm.orders.filter.all') },
    { value: 'short', label: t('sendAdm.orders.filter.short'), count: counts.short },
    { value: 'surplus', label: t('sendAdm.orders.filter.surplus'), count: counts.surplus },
    { value: 'ok', label: t('sendAdm.orders.filter.ok'), count: counts.ok },
  ];
  return (
    <div className="sa-orders-tools">
      {counts.short + counts.surplus > 0 && <p className="sa-w2">{t('warn.W2', { a: counts.short, b: counts.surplus, c: counts.ok })}</p>}
      <Segmented label={t('sendAdm.orders.filter.label')} value={filter} options={opts} onChange={onFilter} />
    </div>
  );
}

export function SendAdmOrders({ rows, qty }: { rows: OrderRow[]; qty: OrderQty }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const counts = useTones(rows, qty);
  const shown = filter === 'all' ? rows : rows.filter((r) => counts.tones.get(r.key) === filter);
  const delivered = rows.some((r) => r.delivered > 0);
  const n = (v: number) => v.toLocaleString('vi-VN');
  const cols = [t('sendAdm.orders.registered'), ...(delivered ? [t('sendAdm.orders.delivered')] : []), t('sendAdm.orders.backlog'), t('sendAdm.orders.stock'), t('sendAdm.orders.need')];
  return (
    <section className="sa-card" aria-labelledby="sa-orders-title">
      <h2 id="sa-orders-title">{t('sendAdm.orders.title')}</h2>
      <p className="sa-note">{t('sendAdm.orders.intro')}</p>
      <p className="sa-note">{t('sendAdm.orders.formula')}</p>
      {rows.length === 0 ? (
        <p className="sa-note">{t('sendAdm.orders.empty')}</p>
      ) : (
        <>
          <Toolbar counts={counts} filter={filter} onFilter={setFilter} />
          <table className="sa-orders" aria-label={t('sendAdm.orders.label')}>
            <thead>
              <tr>
                <th scope="col">{t('sendAdm.orders.item')}</th>
                {cols.map((c) => (
                  <th key={c} scope="col" className="n">{c}</th>
                ))}
                <th scope="col" className="n">{t('sendAdm.orders.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const vals = [r.registered, ...(delivered ? [r.delivered] : []), r.backlog, r.stock, r.want];
                return (
                  <tr key={r.key}>
                    <ItemCell row={r} />
                    {vals.map((v, i) => (
                      <td key={cols[i]} className="n" data-label={cols[i]}>{v === null ? '—' : n(v)}</td>
                    ))}
                    <td className="n sa-qty" data-label={t('sendAdm.orders.qty')}>
                      <OrderCell row={r} value={qty.value(r.key)} error={qty.hasError(r.key)} onEdit={(text) => qty.set(r.key, text)} onReset={() => qty.reset(r.key)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
