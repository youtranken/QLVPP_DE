import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { isLowStock } from '@/features/stock/stock.api';

export type StockAction = 'purchase' | 'adjust' | 'issue' | 'ledger';

const ACTIONS: StockAction[] = ['purchase', 'adjust', 'issue', 'ledger'];

export function useStockColumns(onAction: (action: StockAction, item: AdminItem) => void): ColumnDef<AdminItem, unknown>[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('stock.page.colName'),
        cell: ({ row }) => (
          <div className="item-name">
            <b>{row.original.name}</b>
            {row.original.pack_note && <small>{row.original.pack_note}</small>}
          </div>
        ),
      },
      {
        id: 'unit',
        accessorFn: (r) => t(`catalog.units.${r.unit}`),
        header: t('stock.page.colUnit'),
      },
      {
        accessorKey: 'stock_qty',
        header: t('stock.page.colStock'),
        enableGlobalFilter: false,
        meta: { className: 'num r' },
        cell: ({ row }) => <b className={isLowStock(row.original) ? 'stock-low' : undefined}>{row.original.stock_qty}</b>,
      },
      {
        accessorKey: 'min_stock',
        header: t('stock.page.colMin'),
        enableGlobalFilter: false,
        meta: { className: 'num r' },
      },
      {
        id: 'status',
        header: t('stock.page.colStatus'),
        enableGlobalFilter: false,
        accessorFn: (r) => (isLowStock(r) ? 0 : 1),
        cell: ({ row }) =>
          isLowStock(row.original) ? <span className="tag tag--danger">{t('stock.page.low')}</span> : null,
      },
      {
        id: 'actions',
        header: t('stock.page.colActions'),
        meta: { className: 'col-actions' },
        cell: ({ row }) => (
          <div className="row-actions">
            {ACTIONS.map((a) => (
              <button key={a} type="button" className="btn btn--sm" onClick={() => onAction(a, row.original)}>
                {t(`stock.page.${a}`)}
              </button>
            ))}
          </div>
        ),
      },
    ],
    [onAction, t],
  );
}
