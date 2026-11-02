import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { ItemThumb } from '@/ui/item-thumb';
import { RowMenu, type RowMenuItem } from '@/ui/row-menu';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { useUnitNames } from '@/features/units/units.api';
import type { ReactNode } from 'react';
import type { StockRow } from './stock-rows';

export type StockAction = 'purchase' | 'count' | 'issue' | 'ledger';

export function StockBadge({ state }: { state: StockRow['stock_state'] }) {
  const { t } = useTranslation();
  if (state === 'out') return <span className="tag tag--danger">{t('stock.page.out')}</span>;
  if (state === 'low') return <span className="tag tag--warn">{t('stock.page.low')}</span>;
  if (state === 'ok') return <span className="tag tag--ok">{t('stock.page.ok')}</span>;
  return null;
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

// 390: Nhập mua vào ⋯ để hàng thẻ không bị nút chiếm chỗ; 1280: nút nhỏ luôn hiện (không chỉ khi rê chuột)
function RowActions({ row: r, onAction }: { row: StockRow; onAction: (a: StockAction, r: StockRow) => void }) {
  const { t } = useTranslation();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const empty = r.stock_qty <= 0;
  const purchase: RowMenuItem = { label: t('stock.page.purchase'), onSelect: () => onAction('purchase', r) };
  const items: RowMenuItem[] = [
    { label: t('stock.page.count'), onSelect: () => onAction('count', r) },
    { label: t('stock.page.issue'), disabled: empty, title: empty ? t('stock.page.issueDisabled') : undefined, onSelect: () => onAction('issue', r) },
    { label: t('stock.page.ledger'), onSelect: () => onAction('ledger', r) },
  ];
  return (
    <span className="sk-actions__row">
      {!phone && (
        <button type="button" className="btn btn--ghost btn--sm sk-purchase" onClick={purchase.onSelect}>
          {purchase.label}
        </button>
      )}
      <RowMenu label={t('stock.page.more', { name: r.name })} items={phone ? [purchase, ...items] : items} />
    </span>
  );
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
              <small className="sk-item__note">{[groupName(r), r.pack_note].filter(Boolean).join(' · ')}</small>
            </span>
          </span>
        ),
      },
      { id: 'unit', header: t('stock.page.colUnit'), cell: ({ row }) => unitName(row.original.unit) },
      { id: 'stock', header: t('stock.page.colStock'), meta: { className: 'num r' }, cell: ({ row }) => <b>{row.original.stock_qty}</b> },
      { id: 'status', header: t('stock.page.colStatus'), cell: ({ row }) => <StockBadge state={row.original.stock_state} /> },
      { id: 'owed', header: t('stock.page.colOwed'), meta: { className: 'num r' }, cell: ({ row }) => (row.original.owed > 0 ? row.original.owed : t('common.empty')) },
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
