import { useTranslation } from 'react-i18next';
import { useUnitName } from '@/features/units/units.api';
import { pickName, type MonthReport, type ReportCustomRow, type ReportItemRow } from './reports.api';

type Row = ReportItemRow | ReportCustomRow;

function ItemRow({ row, name, sub, frozen }: { row: Row; name: string; sub?: string; frozen: Record<string, number> }) {
  const { t } = useTranslation();
  const unitName = useUnitName(row.unit);
  const cols = {
    unit: t('reports.items.colUnit'),
    requested: t('reports.items.colRequested'),
    backlog: t('reports.items.colBacklog'),
    stock: t('reports.items.colStock'),
    need: t('reports.items.colNeed'),
    order: t('reports.items.colOrder'),
  };
  return (
    <tr>
      <td data-label="">
        <b className="rp-name">{name}</b>
        {sub && <small className="rp-sub">{sub}</small>}
      </td>
      <td data-label={cols.unit}>{unitName}</td>
      <td className="r num" data-label={cols.requested}>{row.requested}</td>
      <td className="r num" data-label={cols.backlog}>{row.backlog_prev}</td>
      <td className="r num" data-label={cols.stock}>{row.stock ?? '—'}</td>
      <td className="r num" data-label={cols.need}>{row.need}</td>
      <td className="r num" data-label={cols.order}>{frozen[row.key] ?? row.need}</td>
    </tr>
  );
}

// Bảng phẳng của bản in: số Đặt mua lấy đúng từ bản chốt
export function ReportItemTable({ report, frozen }: { report: MonthReport; frozen: Record<string, number> }) {
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
            <ItemRow key={r.key} row={r} name={pickName(i18n.language, r.name, r.name_en)} frozen={frozen} />
          ))}
          {report.custom.length > 0 && (
            <tr className="rp-group">
              <th scope="row" colSpan={7}>
                {t('reports.items.custom')}
              </th>
            </tr>
          )}
          {report.custom.map((r) => (
            <ItemRow key={r.key} row={r} name={r.name} sub={t('reports.items.people', { count: r.people })} frozen={frozen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
