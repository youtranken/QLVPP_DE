import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { vnSavedAt } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import { Progress } from '@/ui/progress';
import type { PersonRow } from '@/features/summary/summary.api';

interface Props {
  rows: PersonRow[];
  loading: boolean;
  busy: boolean;
  narrowed: boolean;
  activeId?: string;
  onView: (row: PersonRow) => void;
  onAdjust: (requestId: string) => void;
  // Lọc/tìm không ra: nút Xóa lọc trong khung trống đưa về chip Tất cả, ô tìm rỗng
  onClear?: () => void;
}

const nameOf = (r: PersonRow) => r.full_name ?? r.email ?? r.user_sub;
const NO_DEPT = '\u0000';

function DeliveryCell({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  if (row.total_qty === 0) return <span className="sm-muted">{t('common.empty')}</span>;
  const done = row.delivered_qty + row.cancelled_qty;
  return <Progress done={done} total={row.total_qty} label={t('summary.table.delivered', { done, total: row.total_qty })} />;
}

function Notes({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  return (
    <span className="mk-notes">
      {row.over_max && <span className="tag tag--warn">{t('month.notes.overMax')}</span>}
      {row.adjusted && <span className="tag tag--outline">{t('month.notes.adjusted')}</span>}
      {row.total_qty === 0 && <span className="sm-muted">{t('month.notes.nothing')}</span>}
      {row.custom_pending > 0 && <span className="tag tag--warn">{t('month.notes.custom')}</span>}
    </span>
  );
}

function SavedAt({ iso }: { iso: string }) {
  const { t } = useTranslation();
  const at = vnSavedAt(iso);
  return <span className="sm-muted num">{at.today ? t('summary.table.savedToday', at) : t('summary.table.savedOn', at)}</span>;
}

function useColumns(busy: boolean, onView: Props['onView'], onAdjust: Props['onAdjust']) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<PersonRow, unknown>[]>(() => {
    const columns: ColumnDef<PersonRow, unknown>[] = [
      {
        id: 'person',
        header: t('summary.table.person'),
        cell: ({ row: { original: r } }) => (
          <span className="sm-person">
            <span className="sm-avatar" aria-hidden="true">{nameOf(r).trim().charAt(0).toUpperCase()}</span>
            <span className="sm-person__name">{nameOf(r)}</span>
            {r.user_status !== 'active' && <span className="tag tag--outline">{t('summary.table.leftCompany')}</span>}
          </span>
        ),
      },
      { id: 'team', header: t('month.table.team'), cell: ({ row }) => row.original.team ?? t('common.empty') },
      { accessorKey: 'line_count', header: t('summary.table.lines'), meta: { className: 'num r' } },
      { accessorKey: 'total_qty', header: t('summary.table.total'), meta: { className: 'num r' } },
      { id: 'delivery', header: t('summary.table.delivery'), cell: ({ row }) => <DeliveryCell row={row.original} /> },
      { id: 'note', header: t('summary.table.note'), cell: ({ row }) => <Notes row={row.original} /> },
      { id: 'saved', header: t('summary.table.savedAt'), cell: ({ row }) => <SavedAt iso={row.original.saved_at} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('summary.table.actions')}</span>,
        meta: { className: 'r sm-acts' },
        cell: ({ row: { original: r } }) => (
          <>
            <button type="button" className="btn btn--ghost btn--sm" data-view-id={r.request_id} aria-label={t('summary.open.viewFor', { name: nameOf(r) })} disabled={busy} onClick={(e) => { e.stopPropagation(); onView(r); }}>
              {t('summary.open.view')}
            </button>
            <button type="button" className="btn btn--sm" aria-label={t('summary.table.adjustLabel', { name: nameOf(r) })} disabled={busy} onClick={(e) => { e.stopPropagation(); onAdjust(r.request_id); }}>
              {t('summary.table.adjust')}
            </button>
          </>
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
      groupBy={{
        key: (r) => r.department ?? NO_DEPT,
        header: (key, list) => (
          <>
            <b>{key === NO_DEPT ? t('month.table.noDepartment') : key}</b>
            <span className="sm-group-meta">{t('summary.table.groupPeople', { n: list.length })}</span>
          </>
        ),
      }}
      activeRowId={activeId}
      tableClassName={['grid-table', busy && 'is-stale'].filter(Boolean).join(' ')}
    />
  );
}
