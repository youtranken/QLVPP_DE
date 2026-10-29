import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatTime } from '@/lib/format-time';
import { pickName, type ReportIssue } from './reports.api';

export function IssuesTable({ issues }: { issues: ReportIssue[] }) {
  const { t, i18n } = useTranslation();
  const fmt = useFormatTime();
  const titleId = useId();
  if (issues.length === 0) return null;
  const col = (k: string) => t(`reports.issues.${k}`);
  return (
    <section className="rp-sub-section" aria-labelledby={titleId}>
      <h3 id={titleId} className="rp-h3">
        {col('title')}
      </h3>
      <div className="table-wrap">
        <table className="table table-stack rp-table">
          <thead>
            <tr>
              <th>{col('colName')}</th>
              <th>{col('colUnit')}</th>
              <th>{col('colRecipient')}</th>
              <th className="r">{col('colQty')}</th>
              <th>{col('colReason')}</th>
              <th>{col('colAt')}</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((r, i) => (
              <tr key={`${r.at}-${i}`}>
                <td data-label="">
                  <b className="rp-name">{pickName(i18n.language, r.item_name, r.item_name_en)}</b>
                </td>
                <td data-label={col('colUnit')}>{t(`catalog.units.${r.unit}`, { defaultValue: r.unit })}</td>
                <td data-label={col('colRecipient')}>{r.recipient_sub ? (r.recipient_name ?? r.recipient_sub) : col('shared')}</td>
                <td className="r num" data-label={col('colQty')}>{r.qty}</td>
                <td data-label={col('colReason')}>{r.reason}</td>
                <td data-label={col('colAt')}>{fmt(r.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
