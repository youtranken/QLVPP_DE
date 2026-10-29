import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { pickName, ORDER_QTY_MAX, type MonthReport, type ReportCustomRow, type ReportItemRow } from './reports.api';
import type { OrderQty } from './use-order-qty';

type Row = ReportItemRow | ReportCustomRow;

function OrderCell({ row, name, qty, label }: { row: Row; name: string; qty: OrderQty; label: string }) {
  const { t } = useTranslation();
  const errId = useId();
  const error = qty.hasError(row.key);
  return (
    <td className={qty.isEdited(row.key) ? 'r rp-order is-edited' : 'r rp-order'} data-label={label}>
      <div className="rp-order-box">
        <input
          className="a-input rp-qty num"
          type="number"
          inputMode="numeric"
          min={0}
          max={ORDER_QTY_MAX}
          step={1}
          value={qty.value(row.key)}
          aria-label={t('reports.items.orderLabel', { name })}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => qty.set(row.key, e.target.value)}
        />
        {qty.isEdited(row.key) && (
          <button type="button" className="btn btn--sm rp-reset" aria-label={t('reports.items.resetNeedLabel', { name })} onClick={() => qty.reset(row.key)}>
            {t('reports.items.resetNeed')}
          </button>
        )}
      </div>
      {error && (
        <p id={errId} className="ff-error">
          {t('reports.items.orderInvalid')}
        </p>
      )}
    </td>
  );
}

function ItemRow({ row, name, sub, qty }: { row: Row; name: string; sub?: string; qty: OrderQty }) {
  const { t } = useTranslation();
  const cols = {
    unit: t('reports.items.colUnit'),
    requested: t('reports.items.colRequested'),
    backlog: t('reports.items.colBacklog'),
    stock: t('reports.items.colStock'),
    need: t('reports.items.colNeed'),
  };
  return (
    <tr>
      <td data-label="">
        <b className="rp-name">{name}</b>
        {sub && <small className="rp-sub">{sub}</small>}
      </td>
      <td data-label={cols.unit}>{t(`catalog.units.${row.unit}`, { defaultValue: row.unit })}</td>
      <td className="r num" data-label={cols.requested}>{row.requested}</td>
      <td className="r num" data-label={cols.backlog}>{row.backlog_prev}</td>
      <td className="r num" data-label={cols.stock}>{row.stock ?? '—'}</td>
      <td className="r num" data-label={cols.need}>{row.need}</td>
      <OrderCell row={row} name={name} qty={qty} label={t('reports.items.colOrder')} />
    </tr>
  );
}

export function ReportItemTable({ report, qty }: { report: MonthReport; qty: OrderQty }) {
  const { t, i18n } = useTranslation();
  const empty = report.byItem.length === 0 && report.custom.length === 0;
  return (
    <div className="table-wrap">
      <table className="table table-stack rp-table">
        <thead>
          <tr>
            <th>{t('reports.items.colName')}</th>
            <th>{t('reports.items.colUnit')}</th>
            <th className="r">{t('reports.items.colRequested')}</th>
            <th className="r">{t('reports.items.colBacklog')}</th>
            <th className="r">{t('reports.items.colStock')}</th>
            <th className="r">{t('reports.items.colNeed')}</th>
            <th className="r">{t('reports.items.colOrder')}</th>
          </tr>
        </thead>
        <tbody>
          {empty && (
            <tr>
              <td colSpan={7}>
                <div className="empty">{t('reports.items.empty')}</div>
              </td>
            </tr>
          )}
          {report.byItem.map((r) => (
            <ItemRow key={r.key} row={r} name={pickName(i18n.language, r.name, r.name_en)} qty={qty} />
          ))}
          {report.custom.length > 0 && (
            <tr className="rp-group">
              <th scope="row" colSpan={7}>
                {t('reports.items.custom')}
              </th>
            </tr>
          )}
          {report.custom.map((r) => (
            <ItemRow key={r.key} row={r} name={r.name} sub={t('reports.items.people', { count: r.people })} qty={qty} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
