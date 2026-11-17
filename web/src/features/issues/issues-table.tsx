import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import { useUnitNames } from '@/features/units/units.api';
import type { IssueRow } from '@/features/stock/stock.api';

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
      { id: 'date', header: t('stock.issues.colDate'), meta: { width: '7rem' }, cell: ({ row }) => dayThenTime(row.original.created_at) },
      {
        id: 'item',
        header: t('stock.issues.colItem'),
        meta: { minWidth: '10rem' },
        cell: ({ row: { original: r } }) => (i18n.language === 'en' && r.item_name_en ? r.item_name_en : r.item_name),
      },
      { id: 'qty', header: t('stock.issues.colQty'), meta: { className: 'num r', width: '6rem' }, cell: ({ row: { original: r } }) => `${r.qty} ${unitName(r.unit)}` },
      {
        id: 'recipient',
        header: t('stock.issues.colRecipient'),
        meta: { width: '11rem' },
        cell: ({ row: { original: r } }) => (r.recipient_sub === null ? t('stock.issues.shared') : (r.recipient_name ?? dash)),
      },
      { id: 'note', header: t('stock.issues.colNote'), meta: { width: '12rem' }, cell: ({ row }) => row.original.note ?? dash },
      { id: 'actor', header: t('stock.issues.colActor'), meta: { width: '10rem' }, cell: ({ row }) => row.original.actor_name ?? dash },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, i18n.language, unitName]);
}

export function IssuesTable({ rows, loading }: { rows: IssueRow[]; loading: boolean }) {
  const { t } = useTranslation();
  const columns = useColumns();
  return <DataTable data={rows} columns={columns} stackOnMobile loading={loading} emptyText={t('stock.issues.empty')} empty={{ art: 'nothing-deliver' }} />;
}
