import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { Icon } from '@/ui/icon';
import { ItemThumb } from '@/ui/item-thumb';
import { useUnitNames } from '@/features/units/units.api';
import type { ReactNode } from 'react';
import type { StockRow } from './stock-rows';

export type StockAction = 'purchase' | 'adjust' | 'issue' | 'ledger';

const ACTIONS = ['purchase', 'adjust', 'issue'] as const;

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
        cell: ({ row: { original: r } }) => (
          <span className="sk-actions__row">
            {ACTIONS.map((a) =>
              a === 'issue' ? (
                <IssueButton key={a} item={r} className="btn btn--sm" onClick={() => onAction(a, r)} />
              ) : (
                <button key={a} type="button" className="btn btn--sm" onClick={() => onAction(a, r)}>
                  {t(`stock.page.${a}`)}
                </button>
              ),
            )}
            <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('stock.page.ledgerIcon', { name: r.name })} onClick={() => onAction('ledger', r)}>
              <Icon name="scroll" size={18} />
            </button>
          </span>
        ),
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
