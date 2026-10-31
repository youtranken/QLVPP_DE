import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { useUnregistered, type UnregisteredUser } from './summary.api';

type Row = UnregisteredUser & { id: string };

interface Props {
  ym: string;
  canCreate: boolean;
  onCreate: (user: DirectoryUser) => void;
  onClearFilter: () => void;
}

const nameOf = (u: UnregisteredUser) => u.full_name ?? u.email ?? u.sub;

export function UnregisteredTable({ ym, canCreate, onCreate, onClearFilter }: Props) {
  const { t } = useTranslation();
  const noteId = useId();
  const query = useUnregistered(ym);
  const rows = useMemo<Row[]>(() => (query.data?.items ?? []).map((u) => ({ ...u, id: u.sub })), [query.data]);
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => {
      const columns: ColumnDef<Row, unknown>[] = [
        { id: 'name', header: t('summary.unregistered.name'), cell: ({ row }) => <b>{nameOf(row.original)}</b> },
        {
          id: 'department',
          header: t('summary.unregistered.department'),
          cell: ({ row }) => row.original.department ?? <span className="sm-muted">{t('summary.table.noDepartment')}</span>,
        },
        {
          id: 'actions',
          header: () => <span className="sr-only">{t('summary.table.actions')}</span>,
          meta: { className: 'r' },
          cell: ({ row: { original: u } }) => (
            <button
              type="button"
              className="btn btn--sm"
              disabled={!canCreate}
              aria-label={t('summary.unregistered.createLabel', { name: nameOf(u) })}
              aria-describedby={canCreate ? undefined : noteId}
              onClick={() => onCreate({ sub: u.sub, fullName: u.full_name, email: u.email, department: u.department, status: 'active' })}
            >
              {t('summary.create.button')}
            </button>
          ),
        },
      ];
      return columns.map((c) => ({ ...c, enableSorting: false }));
    },
    [t, canCreate, noteId, onCreate],
  );

  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  return (
    <>
      <FilterNotice label={t('summary.filters.unregistered')} count={t('summary.filters.people', { n: rows.length })} onClear={onClearFilter} />
      {!canCreate && (
        <p id={noteId} className="sm-note">
          {t('summary.unregistered.lockedNote')}
        </p>
      )}
      <DataTable data={rows} columns={columns} stackOnMobile loading={query.isPending} emptyText={t('summary.unregistered.allDone')} />
    </>
  );
}
