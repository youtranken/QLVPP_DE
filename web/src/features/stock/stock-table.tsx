import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { ItemThumb } from '@/ui/item-thumb';
import { RowMenu, type RowMenuItem } from '@/ui/row-menu';
import { useUnitNames } from '@/features/units/units.api';
import type { ReactNode } from 'react';
import { EmptyValue } from '@/ui/empty-cell';
import { periodShortOf, stockViewOf, type StockRow, type StockStatus } from './stock-rows';
import { useDisabledReason } from '@/ui/disabled-reason';

export type StockAction = 'purchase' | 'issue' | 'ledger';

const BADGE_CLASS: Record<StockStatus, string> = {
  paused: 'tag tag--outline',
  incoming: 'tag tag--danger',
  none: 'tag tag--outline',
  low: 'tag tag--warn',
  untracked: 'tag tag--outline',
  ok: 'tag tag--ok',
};

// "Thiếu kỳ này" luôn đỏ để thủ kho nhìn lướt là thấy món đang nợ người chờ; tủ 0 không ai cần chỉ xám
export function StockBadge({ row }: { row: Pick<StockRow, 'usable' | 'stock_state' | 'short' | 'awaiting' | 'free' | 'held' | 'stock_qty'> }) {
  const { t } = useTranslation();
  const status = stockViewOf(row);
  const text: Record<StockStatus, string> = {
    paused: t('stock.state.paused'),
    incoming: t('stock.state.short', { n: periodShortOf(row) }),
    none: t('stock.state.none'),
    low: t('stock.state.low'),
    untracked: t('stock.state.untracked'),
    ok: t('stock.state.ok', { n: row.free }),
  };
  // Hàng NCC về không đủ bù cho người chờ: câu giải thích phần thiếu nằm trong title; về đủ bù thì nói số đang về
  const title = status !== 'incoming' ? undefined : row.short > 0 ? t('warn.W20short', { short: row.short }) : row.awaiting > 0 ? t('stock.state.awaiting', { n: row.awaiting }) : undefined;
  const badge = (
    <span className={BADGE_CLASS[status]} title={title}>
      {text[status]}
    </span>
  );
  if (status !== 'incoming' || row.usable) return badge;
  return (
    <span className="sk-badges">
      {badge}
      <span className="tag tag--outline">{t('stock.state.paused')}</span>
    </span>
  );
}

// Món còn đủ để "—": nhãn xanh lặp số ở cột Trong tủ làm nhãn cảnh báo khó nổi
function StatusCell({ row }: { row: StockRow }) {
  return stockViewOf(row) === 'ok' ? <EmptyValue /> : <StockBadge row={row} />;
}

export function IssueButton({ item, onClick, className }: { item: Pick<StockRow, 'stock_qty'>; onClick: () => void; className: string }) {
  const { t } = useTranslation();
  const empty = item.stock_qty <= 0;
  const reason = useDisabledReason(empty ? t('common.disabledReason.noStock') : null);
  return (
    <>
      <button type="button" className={className} disabled={empty} aria-describedby={reason.describedBy} onClick={onClick}>
        {t('stock.page.issue')}
      </button>
      {reason.node}
    </>
  );
}

function RowActions({ row: r, onAction }: { row: StockRow; onAction: (a: StockAction, r: StockRow) => void }) {
  const { t } = useTranslation();
  const empty = r.stock_qty <= 0;
  const items: RowMenuItem[] = [
    { label: t('stock.page.issue'), disabled: empty, title: empty ? t('stock.page.issueDisabled') : undefined, onSelect: () => onAction('issue', r) },
    { label: t('stock.page.ledger'), onSelect: () => onAction('ledger', r) },
    { label: t('stock.actions.buyOutside'), onSelect: () => onAction('purchase', r) },
  ];
  return <RowMenu label={t('stock.page.more', { name: r.name })} items={items} />;
}

function useColumns(groupName: (r: StockRow) => string, onAction: (a: StockAction, r: StockRow) => void) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  return useMemo<ColumnDef<StockRow, unknown>[]>(() => {
    const columns: ColumnDef<StockRow, unknown>[] = [
      {
        id: 'item',
        header: t('stock.page.colItem'),
        cell: ({ row: { original: r } }) => (
          <span className="sk-item">
            <ItemThumb fileId={r.image_file_id} alt="" tone={r.tone} size={36} category={groupName(r)} />
            <span className="sk-item__text">
              <button type="button" className="sk-item__name" aria-label={t('stock.page.openLedger', { name: r.name })} onClick={() => onAction('ledger', r)}>
                {r.name}
              </button>
              <small className="sk-item__note">
                {[groupName(r), r.pack_note].filter(Boolean).join(' · ')}
              </small>
            </span>
          </span>
        ),
      },
      { id: 'unit', header: t('stock.page.colUnit'), meta: { width: '4.5rem' }, cell: ({ row }) => unitName(row.original.unit) },
      { id: 'stock', header: t('stock.page.colStock'), meta: { className: 'num r', width: '5rem' }, cell: ({ row }) => <b>{row.original.stock_qty}</b> },
      { id: 'restock', header: t('stock.page.colRestock'), meta: { className: 'num r', width: '6.5rem' }, cell: ({ row }) => row.original.restock_level ?? <EmptyValue /> },
      { id: 'status', header: t('stock.page.colStatus'), meta: { width: '10rem' }, cell: ({ row }) => <StatusCell row={row.original} /> },
      // Cần thêm = phần còn thiếu sau khi trừ hàng NCC đang về (server short)
      { id: 'need', header: t('stock.page.colNeed'), meta: { className: 'num r', width: '5.5rem' }, cell: ({ row }) => (row.original.short > 0 ? <b>{row.original.short}</b> : <EmptyValue />) },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('stock.page.colActions')}</span>,
        meta: { className: 'sk-actions', width: '4rem' },
        cell: ({ row: { original: r } }) => <RowActions row={r} onAction={onAction} />,
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, unitName, groupName, onAction]);
}

interface Props {
  rows: StockRow[];
  activeRowId?: string;
  loading: boolean;
  groupName: (r: StockRow) => string;
  onAction: (a: StockAction, r: StockRow) => void;
  empty: { title: string; hint?: string; action: ReactNode };
}

export function StockTable({ rows, activeRowId, loading, groupName, onAction, empty }: Props) {
  const columns = useColumns(groupName, onAction);
  return (
    <DataTable
      data={rows}
      columns={columns}
      stackOnMobile
      loading={loading}
      activeRowId={activeRowId}
      emptyText={empty.title}
      empty={{ variant: 'no-match', hint: empty.hint, action: empty.action }}
    />
  );
}
