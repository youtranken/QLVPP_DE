import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { requestStatus, requestStatusText } from '@/lib/request-status';
import { DataTable } from '@/ui/data-table';
import { EmptyValue } from '@/ui/empty-cell';
import { RowMenu } from '@/ui/row-menu';
import type { PersonRow } from '@/features/summary/summary.api';

interface Props {
  rows: PersonRow[];
  loading: boolean;
  busy: boolean;
  narrowed: boolean;
  activeId?: string;
  onView: (row: PersonRow) => void;
  onAdjust: (requestId: string) => void;
  // Lọc/tìm không ra: nút Xóa lọc trong khung trống đưa về chip Tất cả, ô tìm rỗng, mọi khu
  onClear?: () => void;
}

const nameOf = (r: PersonRow) => r.full_name ?? r.email ?? r.user_sub;

function PersonCell({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  const saved = t('month.table.savedOn', { date: formatVnStamp(row.saved_at).split(' ')[1] });
  const sub = [row.department, row.team, saved].filter(Boolean).join(' · ');
  return (
    <span className="sm-person">
      <span className="sm-avatar" aria-hidden="true">{nameOf(row).trim().charAt(0).toUpperCase()}</span>
      <span className="mk-person__text">
        <span className="sm-person__name">{nameOf(row)}</span>
        {row.user_status !== 'active' && <span className="tag tag--outline">{t('summary.table.leftCompany')}</span>}
        <small className="mk-person__sub">{sub}</small>
      </span>
    </span>
  );
}

function OrderCell({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  return (
    <span className="mk-order">
      <span className="num">{t('month.table.orderValue', { lines: row.line_count, qty: row.total_qty })}</span>
      {row.custom_pending > 0 && <span className="tag tag--warn">{t('month.table.pendingReview', { n: row.custom_pending })}</span>}
    </span>
  );
}

// Tủ so với tổng còn phải giao của món cả kỳ (server tính short_items); đã giao xong thì không còn gì để so
function StockCell({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  if (row.delivered_qty + row.cancelled_qty >= row.total_qty) return <EmptyValue />;
  if (row.short_items.length === 0) return <span className="tag tag--ok">{t('month.table.stockOk')}</span>;
  const text = t('month.table.stockShort', { names: row.short_items.join(', ') });
  return (
    <span className="tag tag--warn mk-short" title={text}>
      {text}
    </span>
  );
}

function Notes({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  if (!row.over_max && !row.adjusted && row.total_qty !== 0) return <EmptyValue />;
  return (
    <span className="mk-notes">
      {row.over_max && <span className="tag tag--warn">{t('month.notes.overMax')}</span>}
      {row.adjusted && <span className="tag tag--outline">{t('month.notes.adjusted')}</span>}
      {row.total_qty === 0 && <span className="sm-muted">{t('month.notes.nothing')}</span>}
    </span>
  );
}

function StatusCell({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  if (row.total_qty === 0) return <EmptyValue />;
  const status = requestStatus({ qty: row.total_qty, delivered: row.delivered_qty, cancelled: row.cancelled_qty });
  return <span className="sm-muted">{requestStatusText(t, status)}</span>;
}

function useColumns(busy: boolean, onView: Props['onView'], onAdjust: Props['onAdjust']) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<PersonRow, unknown>[]>(() => {
    const columns: ColumnDef<PersonRow, unknown>[] = [
      { id: 'person', header: t('month.table.person'), meta: { minWidth: '12rem' }, cell: ({ row }) => <PersonCell row={row.original} /> },
      { id: 'order', header: t('month.table.order'), meta: { minWidth: '8rem' }, cell: ({ row }) => <OrderCell row={row.original} /> },
      { id: 'stock', header: t('month.table.stock'), meta: { minWidth: '7rem' }, cell: ({ row }) => <StockCell row={row.original} /> },
      { id: 'note', header: t('month.table.note'), meta: { minWidth: '7rem' }, cell: ({ row }) => <Notes row={row.original} /> },
      { id: 'status', header: t('month.table.status'), meta: { width: '8rem' }, cell: ({ row }) => <StatusCell row={row.original} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('summary.table.actions')}</span>,
        meta: { className: 'r sm-acts', width: '3.5rem' },
        cell: ({ row: { original: r } }) =>
          busy ? null : (
            <span onClick={(e) => e.stopPropagation()}>
              <RowMenu
                label={t('month.table.more', { name: nameOf(r) })}
                items={[
                  { label: t('month.table.view'), onSelect: () => onView(r) },
                  { label: t('month.table.adjust'), onSelect: () => onAdjust(r.request_id) },
                ]}
              />
            </span>
          ),
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, busy, onView, onAdjust]);
}

export function MonthPeopleTable({ rows, loading, busy, narrowed, activeId, onView, onAdjust, onClear }: Props) {
  const { t } = useTranslation();
  const columns = useColumns(busy, onView, onAdjust);
  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.request_id })), [rows]);
  return (
    <DataTable
      data={data}
      columns={columns}
      stackOnMobile
      loading={loading}
      busy={busy}
      emptyText={t(narrowed ? 'summary.page.noMatch' : 'summary.page.empty')}
      empty={narrowed ? { variant: 'no-match', hint: t('summary.page.noMatchHint'), onClear } : { art: 'no-request' }}
      onRowClick={busy ? undefined : onView}
      activeRowId={activeId}
      tableClassName={['grid-table', busy && 'is-stale'].filter(Boolean).join(' ')}
    />
  );
}
