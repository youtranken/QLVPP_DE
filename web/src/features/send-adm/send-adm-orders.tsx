import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { useRequestFormat } from '@/features/request/request-format';
import type { OrderQty } from '@/features/reports/use-order-qty';
import type { OrderRow } from './send-adm-rows';

function QtyCell({ row, qty }: { row: OrderRow; qty: OrderQty }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const errId = useId();
  const error = qty.hasError(row.key);
  return (
    <td className="n sa-qty" data-label={t('sendAdm.orders.qty')}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        autoComplete="off"
        value={qty.value(row.key)}
        aria-label={t('sendAdm.orders.qtyLabel', { name: fmt.name(row) })}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => qty.set(row.key, e.target.value)}
      />
      {error && (
        <small id={errId} className="sa-err">
          {t('sendAdm.orders.invalid')}
        </small>
      )}
    </td>
  );
}

export function SendAdmOrders({ rows, qty }: { rows: OrderRow[]; qty: OrderQty }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const n = (v: number) => v.toLocaleString('vi-VN');
  return (
    <section className="sa-card" aria-labelledby="sa-orders-title">
      <h2 id="sa-orders-title">{t('sendAdm.orders.title')}</h2>
      <p className="sa-note">{t('sendAdm.orders.note')}</p>
      {rows.length === 0 ? (
        <p className="sa-note">{t('sendAdm.orders.empty')}</p>
      ) : (
        <div className="sa-orders-scroll">
          <table className="sa-orders" aria-label={t('sendAdm.orders.label')}>
            <thead>
              <tr>
                <th scope="col">{t('sendAdm.orders.item')}</th>
                <th scope="col" className="n">{t('sendAdm.orders.need')}</th>
                <th scope="col" className="n">{t('sendAdm.orders.stock')}</th>
                <th scope="col" className="n">{t('sendAdm.orders.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="sa-item">
                    <div className="sa-item__in">
                      <ItemThumb fileId={r.image_file_id} alt="" tone="g0" size={36} />
                      <span>
                        <b>{fmt.name(r)}</b>
                        <small>{[r.code, r.custom ? t('sendAdm.orders.outside') : null].filter(Boolean).join(' · ') || fmt.unit(r.unit)}</small>
                      </span>
                    </div>
                  </td>
                  <td className="n" data-label={t('sendAdm.orders.need')}>{n(r.need)}</td>
                  <td className="n" data-label={t('sendAdm.orders.stock')}>{r.stock === null ? '—' : n(r.stock)}</td>
                  <QtyCell row={r} qty={qty} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
