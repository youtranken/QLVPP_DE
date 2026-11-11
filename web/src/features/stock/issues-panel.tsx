import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import { LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { useUnitNames } from '@/features/units/units.api';
import { monthOf } from '@/features/request/request-format';
import { vnYmNow } from '@/lib/ym';
import { issuesQuery, type IssueRow } from './stock.api';

const dayThenTime = (iso: string) => {
  const [time, day] = formatVnStamp(iso).split(' ');
  return `${day} ${time}`;
};

function useColumns() {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  return useMemo<ColumnDef<IssueRow, unknown>[]>(() => {
    const dash = t('common.empty');
    const columns: ColumnDef<IssueRow, unknown>[] = [
      { id: 'date', header: t('stock.issues.colDate'), cell: ({ row }) => dayThenTime(row.original.created_at) },
      {
        id: 'item',
        header: t('stock.issues.colItem'),
        cell: ({ row: { original: r } }) => (i18n.language === 'en' && r.item_name_en ? r.item_name_en : r.item_name),
      },
      { id: 'qty', header: t('stock.issues.colQty'), meta: { className: 'num r' }, cell: ({ row: { original: r } }) => `${r.qty} ${unitName(r.unit)}` },
      {
        id: 'recipient',
        header: t('stock.issues.colRecipient'),
        cell: ({ row: { original: r } }) => (r.recipient_sub === null ? t('stock.issues.shared') : (r.recipient_name ?? dash)),
      },
      { id: 'note', header: t('stock.issues.colNote'), cell: ({ row }) => row.original.note ?? dash },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, i18n.language, unitName]);
}

export function IssuesPanel({ ym, onYmChange, end }: { ym: string; onYmChange: (ym: string) => void; end?: ReactNode }) {
  const { t } = useTranslation();
  const q = useQuery(issuesQuery(ym));
  const columns = useColumns();
  const rows = useMemo(() => [...(q.data ?? [])].reverse(), [q.data]);
  const units = rows.reduce((sum, r) => sum + r.qty, 0);
  return (
    <div className="sk-issues">
      <div className="toolbar">
        <MonthSwitcher
          value={ym}
          max={vnYmNow()}
          onChange={onYmChange}
          formatLabel={(v) => t('stock.issues.month', { month: monthOf(v), year: v.slice(0, 4) })}
          labels={{ group: t('stock.issues.monthNav'), prev: t('stock.issues.prevMonth'), next: t('stock.issues.nextMonth') }}
        />
        {q.isSuccess && <p className="sk-issues__total">{t('stock.issues.total', { n: rows.length, units })}</p>}
        {end}
      </div>
      {q.isError ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : (
        <DataTable data={rows} columns={columns} stackOnMobile loading={q.isPending} emptyText={t('stock.issues.empty')} empty={{ art: 'no-match' }} />
      )}
    </div>
  );
}
