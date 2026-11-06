import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { ItemThumb } from '@/ui/item-thumb';
import { RowMenu, type RowMenuItem } from '@/ui/row-menu';
import { useUnitNames } from '@/features/units/units.api';
import type { ReactNode } from 'react';
import type { StockRow } from './stock-rows';

export type StockAction = 'purchase' | 'count' | 'issue' | 'ledger';

const BADGE_CLASS: Record<StockRow['stock_state'], string> = {
  short: 'tag tag--danger',
  incoming: 'tag tag--outline',
  none: 'tag tag--outline',
  low: 'tag tag--warn',
  untracked: 'tag tag--outline',
  ok: 'tag tag--ok',
};

// Đỏ chỉ khi người đang chờ thiếu hàng (đã tính hàng đang về); tủ 0 không ai cần chỉ xám
export function StockBadge({ row }: { row: Pick<StockRow, 'stock_state' | 'short' | 'awaiting' | 'free'> }) {
  const { t } = useTranslation();
  const text: Record<StockRow['stock_state'], string> = {
    short: t('warn.W20short', { short: row.short }),
    incoming: t('warn.W20pending', { n: row.awaiting }),
    none: t('stock.state.none'),
    low: t('stock.state.low'),
    untracked: t('stock.state.untracked'),
    ok: t('stock.state.ok', { n: row.free }),
  };
  return <span className={BADGE_CLASS[row.stock_state]}>{text[row.stock_state]}</span>;
}

export function IssueButton({ item, onClick, className }: { item: Pick<StockRow, 'stock_qty'>; onClick: () => void; className: string }) {
  const { t } = useTranslation();
  const empty = item.stock_qty <= 0;
  return (
    <button type="button" className={className} disabled={empty} title={empty ? t('stock.page.issueDisabled') : undefined} onClick={onClick}>
      {t('stock.page.issue')}
    </button>
  );
}

function RowActions({ row: r, onAction }: { row: StockRow; onAction: (a: StockAction, r: StockRow) => void }) {
  const { t } = useTranslation();
  const empty = r.stock_qty <= 0;
  const items: RowMenuItem[] = [
    { label: t('stock.page.count'), onSelect: () => onAction('count', r) },
    { label: t('stock.page.issue'), disabled: empty, title: empty ? t('stock.page.issueDisabled') : undefined, onSelect: () => onAction('issue', r) },
    { label: t('stock.page.ledger'), onSelect: () => onAction('ledger', r) },
    { label: t('stock.actions.buyOutside'), onSelect: () => onAction('purchase', r) },
  ];
  return <RowMenu label={t('stock.page.more', { name: r.name })} items={items} />;
}

function InactiveTag({ reason }: { reason: StockRow['inactive_reason'] }) {
  const { t } = useTranslation();
  if (!reason) return null;
  return <span className="tag tag--outline">{t(reason === 'item' ? 'catalog.categories.byItem' : 'catalog.categories.byGroup')}</span>;
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
            <ItemThumb fileId={r.image_file_id} alt="" tone={r.tone} size={36} />
            <span className="sk-item__text">
              <button type="button" className="sk-item__name" aria-label={t('stock.page.openLedger', { name: r.name })} onClick={() => onAction('ledger', r)}>
                {r.name}
              </button>
              <small className="sk-item__note">
                {[groupName(r), r.pack_note].filter(Boolean).join(' · ')} <InactiveTag reason={r.inactive_reason} />
              </small>
            </span>
          </span>
        ),
      },
      { id: 'unit', header: t('stock.page.colUnit'), cell: ({ row }) => unitName(row.original.unit) },
      { id: 'stock', header: t('stock.page.colStock'), meta: { className: 'num r' }, cell: ({ row }) => <b>{row.original.stock_qty}</b> },
      { id: 'held', header: t('stock.page.colHeld'), meta: { className: 'num r' }, cell: ({ row }) => row.original.held },
      { id: 'free', header: t('stock.page.colFree'), meta: { className: 'num r' }, cell: ({ row }) => row.original.free },
      { id: 'status', header: t('stock.page.colStatus'), cell: ({ row }) => <StockBadge row={row.original} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('stock.page.colActions')}</span>,
        meta: { className: 'sk-actions' },
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
      empty={{ art: 'no-match', hint: empty.hint, action: empty.action }}
    />
  );
}
