import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { vnSavedStamp } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import { LoadError, Loading } from '@/ui/load-state';
import { useRegistrations, type RegistrationRow } from '@/features/summary/summary.api';

const nameOf = (r: RegistrationRow) => r.full_name ?? r.email ?? r.user_sub;

interface Props {
  ym: string;
  onView: (row: RegistrationRow, rows: RegistrationRow[]) => void;
}

// Kỳ đang đăng ký chỉ xem: người đã có phiếu, không điều chỉnh được
export function MonthOpenTable({ ym, onView }: Props) {
  const { t } = useTranslation();
  const query = useRegistrations(ym);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const columns = useMemo<ColumnDef<RegistrationRow, unknown>[]>(
    () =>
      [
        { id: 'person', header: t('summary.open.colPerson'), cell: ({ row }: { row: { original: RegistrationRow } }) => <span className="sm-person__name">{nameOf(row.original)}</span> },
        { id: 'team', header: t('summary.open.colTeam'), cell: ({ row }: { row: { original: RegistrationRow } }) => row.original.team ?? t('common.empty') },
        { accessorKey: 'line_count', header: t('summary.open.colItems'), meta: { className: 'num r' } },
        { accessorKey: 'total_qty', header: t('summary.table.total'), meta: { className: 'num r' } },
        { id: 'saved', header: t('summary.open.colSaved'), cell: ({ row }: { row: { original: RegistrationRow } }) => <span className="sm-muted num">{vnSavedStamp(row.original.saved_at)}</span> },
        {
          id: 'actions',
          header: () => <span className="sr-only">{t('summary.table.actions')}</span>,
          meta: { className: 'r sm-acts' },
          cell: ({ row }: { row: { original: RegistrationRow } }) => (
            <button type="button" className="btn btn--ghost btn--sm" data-view-id={row.original.request_id} aria-label={t('summary.open.viewFor', { name: nameOf(row.original) })} onClick={() => onView(row.original, rows)}>
              {t('summary.open.view')}
            </button>
          ),
        },
      ].map((c) => ({ ...c, enableSorting: false })) as ColumnDef<RegistrationRow, unknown>[],
    [t, onView, rows],
  );
  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Loading />;
  return <DataTable data={rows} columns={columns} stackOnMobile emptyText={t('summary.open.empty')} tableClassName="grid-table" />;
}
