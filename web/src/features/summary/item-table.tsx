import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { LoadError } from '@/ui/load-state';
import { useItemRows, type ItemSummaryRow } from './summary.api';

export function ItemTable({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const query = useItemRows(ym);
  const columns = useMemo<ColumnDef<ItemSummaryRow, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('summary.item.colName') },
      {
        accessorKey: 'unit',
        header: t('summary.item.colUnit'),
        cell: ({ row }) => t(`catalog.units.${row.original.unit}`, { defaultValue: row.original.unit }),
      },
      {
        accessorKey: 'requested_qty',
        header: t('summary.item.colQty'),
        meta: { className: 'r num' },
      },
      { accessorKey: 'people', header: t('summary.item.colPeople'), meta: { className: 'r num' } },
    ],
    [t],
  );
  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  return (
    <DataTable
      data={query.data?.items ?? []}
      columns={columns}
      loading={query.isPending}
      emptyText={t('summary.item.empty')}
      stackOnMobile
    />
  );
}
