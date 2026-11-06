import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { useUnregistered, type UnregisteredUser } from './summary.api';

type Row = UnregisteredUser & { id: string };

interface Props {
  ym: string;
  // Không truyền → bảng hiện độc lập (kỳ 0 phiếu), không có dải "Đang lọc"
  onClearFilter?: () => void;
}

const nameOf = (u: UnregisteredUser) => u.full_name ?? u.email ?? u.sub;

export function UnregisteredTable({ ym, onClearFilter }: Props) {
  const { t } = useTranslation();
  const query = useUnregistered(ym);
  const rows = useMemo<Row[]>(() => (query.data?.items ?? []).map((u) => ({ ...u, id: u.sub })), [query.data]);
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: 'name', header: t('summary.unregistered.name'), enableSorting: false, cell: ({ row }) => <b>{nameOf(row.original)}</b> },
      {
        id: 'department',
        header: t('summary.unregistered.department'),
        enableSorting: false,
        cell: ({ row }) => row.original.department ?? <span className="sm-muted">{t('summary.table.noDepartment')}</span>,
      },
    ],
    [t],
  );

  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  return (
    <>
      {onClearFilter && (
        <FilterNotice label={t('summary.filters.unregistered')} count={t('summary.filters.people', { n: rows.length })} onClear={onClearFilter} />
      )}
      <DataTable data={rows} columns={columns} stackOnMobile loading={query.isPending} emptyText={t('summary.unregistered.allDone')} />
    </>
  );
}
