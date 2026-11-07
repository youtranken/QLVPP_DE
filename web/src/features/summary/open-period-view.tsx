import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { vnSavedStamp } from '@/lib/format-time';
import { langOf, lockPhrase } from '@/lib/period-text';
import { DataTable } from '@/ui/data-table';
import { LoadError, Loading } from '@/ui/load-state';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import { monthOf } from '@/features/request/request-format';
import { RegistrationDialog } from './registration-dialog';
import { useRegistrations, type PeriodSummary, type RegistrationRow } from './summary.api';

const nameOf = (r: RegistrationRow) => r.full_name ?? r.email ?? r.user_sub;

function useColumns(onView: (row: RegistrationRow) => void) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<RegistrationRow, unknown>[]>(() => {
    const columns: ColumnDef<RegistrationRow, unknown>[] = [
      { id: 'person', header: t('summary.open.colPerson'), cell: ({ row }) => <span className="sm-person__name">{nameOf(row.original)}</span> },
      { id: 'team', header: t('summary.open.colTeam'), cell: ({ row }) => row.original.team ?? t('common.empty') },
      {
        id: 'items',
        header: t('summary.open.colItems'),
        cell: ({ row }) => t('summary.open.itemsCell', { kinds: row.original.line_count, units: row.original.total_qty }),
      },
      { id: 'saved', header: t('summary.open.colSaved'), cell: ({ row }) => <span className="sm-muted num">{vnSavedStamp(row.original.saved_at)}</span> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('summary.table.actions')}</span>,
        meta: { className: 'r sm-acts' },
        cell: ({ row }) => (
          <button type="button" className="btn btn--ghost btn--sm" data-view-id={row.original.request_id} aria-label={t('summary.open.viewFor', { name: nameOf(row.original) })} onClick={() => onView(row.original)}>
            {t('summary.open.view')}
          </button>
        ),
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, onView]);
}

export function OpenPeriodView({ ym, summary }: { ym: string; summary: PeriodSummary }) {
  const { t, i18n } = useTranslation();
  const query = useRegistrations(ym);
  const [viewing, setViewing] = useState<string | null>(null);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const onView = useCallback((row: RegistrationRow) => setViewing(row.request_id), []);
  const columns = useColumns(onView);
  const index = rows.findIndex((r) => r.request_id === viewing);
  const custom = rows.reduce((sum, r) => sum + r.custom_count, 0);
  const lock = summary.deadline ? lockPhrase(summary.deadline, langOf(i18n.language)) : '';
  return (
    <>
      <p className="alert" role="status">
        {t('summary.open.banner', { month: monthOf(ym), lockPhrase: lock })}
      </p>
      <StatRow>
        <StatCard label={t('summary.open.registered')} icon="users" value={`${summary.registered}/${summary.headcount}`} meter={summary.headcount > 0 ? summary.registered / summary.headcount : 0} />
        <StatCard label={t('summary.open.custom')} icon="pkgplus" value={query.data ? custom : '—'} tone={custom > 0 ? 'warn' : 'neutral'} />
      </StatRow>
      <div className="ct-block">
        {query.isError ? (
          <LoadError onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="sm-empty-period">{t('summary.open.empty')}</p>
        ) : (
          <>
            <h2 className="sm-list-title">{t('summary.open.listTitle', { n: rows.length })}</h2>
            <DataTable data={rows} columns={columns} stackOnMobile emptyText={t('summary.open.empty')} />
          </>
        )}
      </div>
      {index >= 0 && <RegistrationDialog ym={ym} deadline={summary.deadline} rows={rows} index={index} onIndex={(i) => setViewing(rows[i].request_id)} onClose={() => setViewing(null)} />}
    </>
  );
}
