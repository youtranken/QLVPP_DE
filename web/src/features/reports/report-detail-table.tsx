import { useTranslation } from 'react-i18next';
import { useUnitNames } from '@/features/units/units.api';
import { pickName, type ReportDepartment } from './reports.api';

export function ReportDetailTable({ departments }: { departments: ReportDepartment[] }) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  const col = (k: string) => t(`reports.detail.${k}`);
  if (departments.length === 0) return <div className="empty">{col('empty')}</div>;
  return (
    <div className="table-wrap">
      <table className="table table-stack rp-table">
        <thead>
          <tr>
            <th>{col('colPerson')}</th>
            <th>{col('colName')}</th>
            <th>{col('colUnit')}</th>
            <th className="r">{col('colQty')}</th>
          </tr>
        </thead>
        {departments.map((d) => (
          <tbody key={d.department ?? ''}>
            <tr className="rp-group">
              <th scope="row" colSpan={4}>
                {d.department ?? col('noDepartment')}
              </th>
            </tr>
            {d.people.flatMap((p) =>
              p.lines.map((l, i) => (
                <tr key={`${p.user_sub}-${i}`} className={i === 0 ? 'rp-person-first' : undefined}>
                  <td data-label="">{i === 0 ? <b>{p.full_name ?? p.user_sub}</b> : <span className="sr-only">{p.full_name ?? p.user_sub}</span>}</td>
                  <td data-label="">{pickName(i18n.language, l.name, l.name_en)}</td>
                  <td data-label={col('colUnit')}>{unitName(l.unit)}</td>
                  <td className="r num" data-label={col('colQty')}>{l.qty}</td>
                </tr>
              )),
            )}
          </tbody>
        ))}
      </table>
    </div>
  );
}
