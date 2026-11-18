import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { vnYmNow } from '@/lib/ym';
import { DataTable } from '@/ui/data-table';
import { EmptyValue } from '@/ui/empty-cell';
import { ListMeta } from '@/ui/list-meta';
import { LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { Segmented } from '@/ui/segmented';
import { Toolbar } from '@/ui/toolbar';
import { monthOf } from '@/features/request/request-format';
import { useUnitNames } from '@/features/units/units.api';
import { LEDGER_KINDS, useStockLedger, type LedgerKind, type LedgerRow } from './stock-ledger.api';
import { useLedgerParams } from './use-ledger-params';

const ALL = 'all';
const signed = (n: number) => (n === 0 ? '0' : n > 0 ? `+${n}` : `−${Math.abs(n)}`);

// Dòng giao/xuất lẻ ghi người nhận; nhập, trả lại, điều chỉnh ghi người làm
const personOf = (r: LedgerRow) => (r.reason === 'delivery' || r.reason === 'issue' ? r.recipient_name : r.actor_name);

type Col = ColumnDef<LedgerRow, unknown>;
type Cell = { row: { original: LedgerRow } };

// Lọc Xuất lẻ (thay trang Xuất lẻ cũ): mọi dòng cùng loại nên bỏ cột Loại, tách Người nhận / Người xuất
function issueColumns(t: TFunction): Col[] {
  return [
    { id: 'recipient', header: t('stock.issues.colRecipient'), meta: { minWidth: '8rem' }, cell: ({ row }: Cell) => row.original.recipient_name ?? t('stock.issues.shared') },
    { id: 'actor', header: t('stock.issues.colActor'), meta: { minWidth: '8rem' }, cell: ({ row }: Cell) => row.original.actor_name ?? <EmptyValue /> },
  ];
}

function useColumns(kind: LedgerKind | null) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  return useMemo<Col[]>(
    () =>
      [
        { id: 'at', header: t('stock.book.colAt'), meta: { width: '8rem' }, cell: ({ row }: { row: { original: LedgerRow } }) => <span className="num">{formatVnStamp(row.original.created_at)}</span> },
        { id: 'item', header: t('stock.book.colItem'), meta: { minWidth: '10rem' }, cell: ({ row }: { row: { original: LedgerRow } }) => row.original.item_name },
        ...(kind === 'issue' ? [] : [{ id: 'kind', header: t('stock.book.colKind'), meta: { width: '7rem' }, cell: ({ row }: Cell) => t(`stock.ledger.tags.${row.original.reason}`) }]),
        {
          id: 'qty',
          header: t('stock.book.colQty'),
          meta: { className: 'num r', width: '7rem' },
          cell: ({ row }: { row: { original: LedgerRow } }) => (
            <span className={row.original.delta > 0 ? 'sk-in' : 'sk-out'}>
              <b>{signed(row.original.delta)}</b> {unitName(row.original.unit)}
            </span>
          ),
        },
        ...(kind === 'issue' ? issueColumns(t) : [{ id: 'person', header: t('stock.book.colPerson'), meta: { minWidth: '8rem' }, cell: ({ row }: Cell) => personOf(row.original) ?? <EmptyValue /> }]),
        { id: 'note', header: t('stock.book.colNote'), meta: { minWidth: '8rem' }, cell: ({ row }: { row: { original: LedgerRow } }) => row.original.note ?? <EmptyValue /> },
      ].map((c) => ({ ...c, enableSorting: false })) as Col[],
    [t, unitName, kind],
  );
}

// Sổ cái toàn kho theo tháng, lọc theo loại, chỉ đọc
export function StockLedgerPage() {
  const { t } = useTranslation();
  const p = useLedgerParams();
  const q = useStockLedger(p.ym, p.kind);
  const columns = useColumns(p.kind);
  const rows = useMemo(() => (q.data?.pages ?? []).flatMap((pg) => pg.items), [q.data]);
  const totals = q.data?.pages[0]?.totals;
  return (
    <>
      <Toolbar
        lead={
          <MonthSwitcher
            value={p.ym}
            max={vnYmNow()}
            onChange={p.setYm}
            formatLabel={(v) => t('stock.issues.month', { month: monthOf(v), year: v.slice(0, 4) })}
            labels={{ group: t('stock.issues.monthNav'), prev: t('stock.issues.prevMonth'), next: t('stock.issues.nextMonth') }}
          />
        }
      >
        <Segmented
          label={t('stock.book.kinds')}
          value={p.kind ?? ALL}
          options={[{ value: ALL, label: t('stock.book.all') }, ...LEDGER_KINDS.map((k) => ({ value: k, label: t(`stock.ledger.tags.${k}`) }))]}
          onChange={(v) => p.setKind(v === ALL ? null : (v as LedgerKind))}
        />
        {totals && <ListMeta>{t('stock.book.totals', { in: signed(totals.in), out: signed(totals.out) })}</ListMeta>}
      </Toolbar>
      {q.isError ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : (
        <>
          <DataTable data={rows} columns={columns} stackOnMobile loading={q.isPending} emptyText={t('stock.book.empty')} tableClassName="grid-table table--cards" ariaLabel={t('stock.ledger.title')} />
          {q.hasNextPage && (
            <button type="button" className="btn sk-more" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              {t('stock.ledger.more')}
            </button>
          )}
        </>
      )}
    </>
  );
}
