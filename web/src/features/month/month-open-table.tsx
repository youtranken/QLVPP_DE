import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import { EmptyValue } from '@/ui/empty-cell';
import { LoadError, Loading } from '@/ui/load-state';
import { RowMenu } from '@/ui/row-menu';
import { useRegistrations, type RegistrationRow } from '@/features/summary/summary.api';
import { MonthPersonText } from './month-person-text';

const nameOf = (r: RegistrationRow) => r.full_name ?? r.email ?? r.user_sub;

interface Props {
  ym: string;
  onView: (row: RegistrationRow, rows: RegistrationRow[]) => void;
}

type Cell = { row: { original: RegistrationRow } };

function useColumns(onView: (row: RegistrationRow) => void) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<RegistrationRow, unknown>[]>(
    () =>
      [
        {
          id: 'person',
          header: t('month.table.person'),
          meta: { minWidth: '12rem' },
          cell: ({ row: { original: r } }: Cell) => (
            <MonthPersonText name={nameOf(r)} sub={[r.team, t('month.table.savedOn', { date: formatVnStamp(r.saved_at).split(' ')[1] })].filter(Boolean).join(' · ')} />
          ),
        },
        { id: 'order', header: t('month.table.order'), meta: { minWidth: '8rem' }, cell: ({ row: { original: r } }: Cell) => <span className="num">{t('month.table.orderValue', { lines: r.line_count, qty: r.total_qty })}</span> },
        { id: 'note', header: t('month.table.note'), meta: { minWidth: '7rem' }, cell: ({ row: { original: r } }: Cell) => (r.custom_count > 0 ? <span className="tag tag--warn">{t('month.notes.custom')}</span> : <EmptyValue />) },
        { id: 'status', header: t('month.table.status'), meta: { width: '8rem' }, cell: () => <span className="tag">{t('month.table.saved')}</span> },
        {
          id: 'actions',
          header: () => <span className="sr-only">{t('summary.table.actions')}</span>,
          meta: { className: 'r sm-acts', width: '3.5rem' },
          cell: ({ row: { original: r } }: Cell) => (
            <span data-view-id={r.request_id} onClick={(e) => e.stopPropagation()}>
              <RowMenu label={t('month.table.more', { name: nameOf(r) })} items={[{ label: t('month.table.view'), onSelect: () => onView(r) }]} />
            </span>
          ),
        },
      ].map((c) => ({ ...c, enableSorting: false })) as ColumnDef<RegistrationRow, unknown>[],
    [t, onView],
  );
}

// Kỳ đang đăng ký chỉ xem: cùng khuôn bảng kỳ đang giao, bấm dòng mở phiếu, không điều chỉnh được
export function MonthOpenTable({ ym, onView }: Props) {
  const { t } = useTranslation();
  const query = useRegistrations(ym);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const view = useMemo(() => (r: RegistrationRow) => onView(r, rows), [onView, rows]);
  const columns = useColumns(view);
  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.request_id })), [rows]);
  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Loading />;
  return <DataTable data={data} columns={columns} stackOnMobile onRowClick={view} emptyText={t('summary.open.empty')} empty={{ art: 'no-request' }} tableClassName="grid-table" />;
}
