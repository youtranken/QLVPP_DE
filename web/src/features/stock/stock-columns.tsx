import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { stockState } from '@/features/stock/stock.api';

export type StockAction = 'purchase' | 'adjust' | 'issue' | 'ledger';

const ACTIONS: StockAction[] = ['purchase', 'adjust', 'issue', 'ledger'];

// Sắp xếp theo trạng thái: hết hàng, sắp hết lên đầu
const STATE_RANK = { out: 0, low: 1, ok: 2, untracked: 3 } as const;

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
        cell: ({ row }) => <b className={STATE_RANK[stockState(row.original)] < 2 ? 'stock-low' : undefined}>{row.original.stock_qty}</b>,
      },
      {
        id: 'status',
        header: t('stock.page.colStatus'),
        enableGlobalFilter: false,
        accessorFn: (r) => STATE_RANK[stockState(r)],
        cell: ({ row }) => {
          const state = stockState(row.original);
          if (state === 'low') return <span className="tag tag--danger">{t('stock.page.low')}</span>;
          if (state === 'out') return <span className="tag tag--out">{t('stock.page.out')}</span>;
          return null;
        },
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
