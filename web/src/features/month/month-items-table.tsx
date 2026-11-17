import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { EmptyValue } from '@/ui/empty-cell';
import { LoadError } from '@/ui/load-state';
import { useUnitNames } from '@/features/units/units.api';
import { useMonthReport } from '@/features/reports/reports.api';
import { useItemRows } from '@/features/summary/summary.api';
import { monthItemRows, type MonthItemRow } from './month-item-rows';

export function MonthItemsTable({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  const items = useItemRows(ym);
  const report = useMonthReport(ym);
  const rows = useMemo(() => (items.data && report.data ? monthItemRows(items.data.items, report.data).map((r) => ({ ...r, id: r.key })) : []), [items.data, report.data]);
  const columns = useMemo<ColumnDef<MonthItemRow, unknown>[]>(
    () =>
      [
        { id: 'name', header: t('month.items.name'), meta: { minWidth: '12rem' }, cell: ({ row }: { row: { original: MonthItemRow } }) => (row.original.custom ? t('month.items.custom') : row.original.name) },
        { id: 'unit', header: t('month.items.unit'), meta: { width: '6rem' }, cell: ({ row }: { row: { original: MonthItemRow } }) => (row.original.custom ? <EmptyValue /> : unitName(row.original.unit)) },
        { accessorKey: 'people', header: t('month.items.people'), meta: { className: 'num r', width: '7rem' } },
        { accessorKey: 'ordered', header: t('month.items.ordered'), meta: { className: 'num r', width: '5rem' } },
        { id: 'stock', header: t('month.items.stock'), meta: { className: 'num r', width: '5rem' }, cell: ({ row }: { row: { original: MonthItemRow } }) => row.original.stock ?? <EmptyValue /> },
        { accessorKey: 'need', header: t('month.items.need'), meta: { className: 'num r', width: '6rem' } },
      ].map((c) => ({ ...c, enableSorting: false })) as ColumnDef<MonthItemRow, unknown>[],
    [t, unitName],
  );
  const failed = [items, report].find((q) => q.isError);
  if (failed) return <LoadError onRetry={() => void failed.refetch()} />;
  return (
    <DataTable
      data={rows}
      columns={columns}
      stackOnMobile
      loading={items.isPending || report.isPending}
      emptyText={t('month.items.empty')}
      empty={{ art: 'no-request' }}
      tableClassName="grid-table"
      ariaLabel={t('month.items.label')}
    />
  );
}
