import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { vnSavedAt } from '@/lib/format-time';
import { shiftYm } from '@/lib/ym';
import { useCurrentPeriod } from '@/features/request/request.api';
import { DataTable } from '@/ui/data-table';
import { FilterNotice } from '@/ui/filter-notice';
import { Icon } from '@/ui/icon';
import { LoadError } from '@/ui/load-state';
import { Progress } from '@/ui/progress';
import type { PersonRow } from './summary.api';
import { usePersonTableRows, type PersonTableFilter, type PersonTableRow as Row } from './use-person-table-rows';

interface Props {
  ym: string;
  locked: boolean;
  filter: PersonTableFilter;
  q: string;
  activeId?: string;
  onOpen: (requestId: string) => void;
  onClearFilter: () => void;
}

const nameOf = (r: PersonRow) => r.full_name ?? r.email ?? r.user_sub;
const NO_DEPT = '\u0000';

function DeliveryCell({ row, locked }: { row: PersonRow; locked: boolean }) {
  const { t } = useTranslation();
  if (!locked) return <span className="sm-muted">{t('summary.table.afterLock')}</span>;
  if (row.total_qty === 0) return <span className="sm-muted">—</span>;
  const done = row.delivered_qty + row.cancelled_qty;
  return <Progress done={done} total={row.total_qty} label={t('summary.table.delivered', { done, total: row.total_qty })} />;
}

function SavedAt({ iso }: { iso: string }) {
  const { t } = useTranslation();
  const at = vnSavedAt(iso);
  return <span className="sm-muted num">{at.today ? t('summary.table.savedToday', at) : t('summary.table.savedOn', at)}</span>;
}

function PersonCell({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  return (
    <span className="sm-person">
      <span className="sm-avatar" aria-hidden="true">{nameOf(row).trim().charAt(0).toUpperCase()}</span>
      <span className="sm-person__name">{nameOf(row)}</span>
      {row.user_status !== 'active' && <span className="tag tag--outline">{t('summary.table.leftCompany')}</span>}
    </span>
  );
}

function PersonActions({ row, ym, locked, stale, newPage, onOpen }: { row: PersonRow; ym: string; locked: boolean; stale: boolean; newPage: boolean; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const canDeliver = locked && row.delivered_qty + row.cancelled_qty < row.total_qty;
  const deliverLabel = t('summary.table.deliverLabel', { name: nameOf(row) });
  return (
    <>
      <button
        type="button"
        className="btn btn--sm"
        aria-label={t('summary.table.adjustLabel', { name: nameOf(row) })}
        disabled={stale}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(row.request_id);
        }}
      >
        {t('summary.table.adjust')}
      </button>
      {canDeliver && !stale && (
        <Link
          className="btn btn--ghost btn--sm sm-icon-btn"
          to={newPage ? `/admin/delivery?person=${encodeURIComponent(row.user_sub)}` : `/admin/delivery/classic?ym=${ym}&request=${row.request_id}`}
          aria-label={deliverLabel}
          title={deliverLabel}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="truck" size={18} />
        </Link>
      )}
    </>
  );
}

function useColumns(ym: string, locked: boolean, stale: boolean, newPage: boolean, onOpen: (id: string) => void) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<Row, unknown>[]>(() => {
    const columns: ColumnDef<Row, unknown>[] = [
      { id: 'person', header: t('summary.table.person'), cell: ({ row }) => <PersonCell row={row.original} /> },
      { accessorKey: 'line_count', header: t('summary.table.lines'), meta: { className: 'num r' } },
      { accessorKey: 'total_qty', header: t('summary.table.total'), meta: { className: 'num r' } },
      { id: 'delivery', header: t('summary.table.delivery'), cell: ({ row }) => <DeliveryCell row={row.original} locked={locked} /> },
      {
        id: 'note',
        header: t('summary.table.note'),
        cell: ({ row: { original: r } }) =>
          r.custom_pending > 0 ? <span className="tag tag--warn">{t('summary.table.customPending', { n: r.custom_pending })}</span> : null,
      },
      { id: 'saved', header: t('summary.table.savedAt'), cell: ({ row }) => <SavedAt iso={row.original.updated_at} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('summary.table.actions')}</span>,
        meta: { className: 'r sm-acts' },
        cell: ({ row }) => <PersonActions row={row.original} ym={ym} locked={locked} stale={stale} newPage={newPage} onOpen={onOpen} />,
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, ym, locked, stale, newPage, onOpen]);
}

export function SummaryPersonTable({ ym, locked, filter, q, activeId, onOpen, onClearFilter }: Props) {
  const { t } = useTranslation();
  const { query, rows } = usePersonTableRows(ym, filter, q);
  const stale = query.isPlaceholderData;
  const current = useCurrentPeriod().data;
  // Trang Giao theo người luôn là kỳ khóa gần nhất; kỳ cũ hơn vẫn giao ở trang cũ
  const newPage = !!current && ym === shiftYm(current.ym, -1);
  const columns = useColumns(ym, locked, stale, newPage, onOpen);

  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  const count = t('summary.filters.people', { n: `${rows.length}${query.hasNextPage ? '+' : ''}` });
  const narrowed = Boolean(filter || q);
  return (
    <>
      {filter && <FilterNotice label={t(`summary.filters.${filter}`)} count={count} onClear={onClearFilter} />}
      <DataTable
        data={rows}
        columns={columns}
        stackOnMobile
        loading={query.isPending}
        busy={stale}
        emptyText={t(narrowed ? 'summary.page.noMatch' : 'summary.page.empty')}
        empty={{
          art: 'no-match',
          hint: narrowed ? t('summary.page.noMatchHint') : undefined,
          action: filter ? (
            <button type="button" className="btn" onClick={onClearFilter}>
              {t('common.filter.clear')}
            </button>
          ) : undefined,
        }}
        groupBy={{
          key: (r) => r.department ?? NO_DEPT,
          header: (key, list) => (
            <>
              <b>{key === NO_DEPT ? t('summary.table.noDepartment') : key}</b>
              <span className="sm-group-meta">{t('summary.table.groupPeople', { n: list.length })}</span>
            </>
          ),
        }}
        activeRowId={activeId}
        onRowClick={stale ? undefined : (r) => onOpen(r.request_id)}
        tableClassName={stale ? 'is-stale' : undefined}
      />
      {query.hasNextPage && (
        <button type="button" className="btn sm-more" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {t('summary.page.more')}
        </button>
      )}
    </>
  );
}
