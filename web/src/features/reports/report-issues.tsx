import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { useFormatTime } from '@/lib/format-time';
import { useUnitNames } from '@/features/units/units.api';
import { pickName, type ReportIssue } from './reports.api';
import { ReportSection } from './report-section';

type Row = ReportIssue & { id: string };

function useColumns() {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  const fmt = useFormatTime();
  return useMemo<ColumnDef<Row, unknown>[]>(() => {
    const col = (k: string) => t(`reports.issues.${k}`);
    const columns: ColumnDef<Row, unknown>[] = [
      { id: 'name', header: col('colName'), cell: ({ row: { original: r } }) => <b className="bc-item__name">{pickName(i18n.language, r.item_name, r.item_name_en)}</b> },
      { id: 'recipient', header: col('colRecipient'), cell: ({ row: { original: r } }) => (r.recipient_sub ? (r.recipient_name ?? r.recipient_sub) : col('shared')) },
      {
        id: 'qty',
        header: col('colQty'),
        meta: { className: 'num r' },
        cell: ({ row: { original: r } }) => (
          <>
            {r.qty} <span className="bc-unit">{unitName(r.unit)}</span>
          </>
        ),
      },
      { id: 'reason', header: col('colReason'), cell: ({ row }) => row.original.reason },
      { id: 'at', header: col('colAt'), cell: ({ row }) => fmt(row.original.at) },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, i18n.language, unitName, fmt]);
}

export function ReportIssues({ issues }: { issues: ReportIssue[] }) {
  const { t } = useTranslation();
  const columns = useColumns();
  const rows = useMemo(() => issues.map((r, i) => ({ ...r, id: `${r.at}-${i}` })), [issues]);
  if (issues.length === 0) return null;
  const note = (
    <>
      {t('reports.issues.note')} <Link to="/admin/stock">{t('reports.issues.openStock')}</Link>
    </>
  );
  return (
    <ReportSection title={t('reports.issues.title')} note={note}>
      <DataTable data={rows} columns={columns} stackOnMobile emptyText="" />
    </ReportSection>
  );
}
