import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import type { Selection } from '@/ui/data-table-row';
import { Icon } from '@/ui/icon';
import { InlineNumber } from '@/ui/inline-number';
import { Switch } from '@/ui/switch';
import { useUnitNames } from '@/features/units/units.api';
import { categoryLabel } from './catalog.api';
import { ItemCell, StockCell, Stop } from './catalog-cells';
import { rowErrorText } from './catalog-errors';
import { NO_GROUP, type CatalogRow, type CategoryIndex } from './catalog-rows';

export interface CatalogTableActions {
  onOpen: (id: string) => void;
  onAddToGroup: (categoryId: string) => void;
  onSaveMax: (row: CatalogRow, n: number) => Promise<void>;
  onToggleActive: (row: CatalogRow) => void;
}

interface Props extends CatalogTableActions {
  rows: CatalogRow[];
  index: CategoryIndex;
  loading: boolean;
  selection: Selection;
  rowErrors: Record<string, string>;
  collapsed: ReadonlySet<string>;
  onCollapsedChange: (next: ReadonlySet<string>) => void;
  empty: { hint: string; action: ReactNode };
}

function useColumns(rowErrors: Record<string, string>, actions: CatalogTableActions) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  const { onOpen, onSaveMax, onToggleActive } = actions;
  return useMemo<ColumnDef<CatalogRow, unknown>[]>(() => {
    const columns: ColumnDef<CatalogRow, unknown>[] = [
      { id: 'code', header: t('catalog.list.colCode'), meta: { className: 'ct-code' }, cell: ({ row }) => row.original.code ?? t('common.empty') },
      { id: 'item', header: t('catalog.list.colItem'), cell: ({ row }) => <ItemCell row={row.original} error={rowErrors[row.original.id]} /> },
      { id: 'unit', header: t('catalog.page.colUnit'), cell: ({ row }) => unitName(row.original.unit) },
      {
        id: 'max',
        header: t('catalog.page.colMax'),
        meta: { className: 'num r' },
        cell: ({ row: { original: r } }) => (
          <Stop>
            <InlineNumber
              value={r.max_qty}
              label={t('catalog.list.maxLabel', { name: r.name, n: r.max_qty })}
              min={1}
              max={999}
              onCommit={(n) => onSaveMax(r, n)}
              formatError={(e) => rowErrorText(e, t)}
            />
          </Stop>
        ),
      },
      { id: 'stock', header: t('catalog.list.colStock'), meta: { className: 'r' }, cell: ({ row }) => <StockCell row={row.original} /> },
      {
        id: 'active',
        header: t('catalog.list.colActive'),
        cell: ({ row: { original: r } }) => (
          <Stop>
            <Switch checked={r.active} label={t(r.active ? 'catalog.list.deactivateLabel' : 'catalog.list.reactivateLabel', { name: r.name })} onChange={() => onToggleActive(r)} />
          </Stop>
        ),
      },
      {
        id: 'edit',
        header: () => <span className="sr-only">{t('catalog.page.edit')}</span>,
        meta: { className: 'ct-edit' },
        cell: ({ row: { original: r } }) => (
          <Stop>
            <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('catalog.page.editLabel', { name: r.name })} onClick={() => onOpen(r.id)}>
              <Icon name="pencil" size={18} />
            </button>
          </Stop>
        ),
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, unitName, rowErrors, onOpen, onSaveMax, onToggleActive]);
}

export function CatalogTable({ rows, index, loading, selection, rowErrors, collapsed, onCollapsedChange, empty, ...actions }: Props) {
  const { t, i18n } = useTranslation();
  const columns = useColumns(rowErrors, actions);
  const groupName = (key: string) => {
    const cat = index.byId.get(key);
    return cat ? categoryLabel(cat, i18n.language) : t('catalog.page.noCategory');
  };
  return (
    <DataTable
      data={rows}
      columns={columns}
      stackOnMobile
      loading={loading}
      selection={selection}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      onRowClick={(r) => actions.onOpen(r.id)}
      rowClassName={(r) => [r.active ? '' : 'is-inactive', rowErrors[r.id] ? 'has-error' : ''].filter(Boolean).join(' ')}
      emptyText={t('catalog.list.emptyTitle')}
      empty={{ art: 'no-match', ...empty }}
      groupBy={{
        key: (r) => r.group,
        header: (key, list) => (
          <span className="ct-group" data-tone={list[0]?.tone ?? 'g0'}>
            <span className="ct-group__thumb" aria-hidden="true">
              <Icon name="pkg" size={16} />
            </span>
            {groupName(key)}
          </span>
        ),
        aside: (key, list) => <GroupAside groupKey={key} name={groupName(key)} list={list} onAdd={actions.onAddToGroup} />,
      }}
    />
  );
}

function GroupAside({ groupKey, name, list, onAdd }: { groupKey: string; name: string; list: CatalogRow[]; onAdd: (id: string) => void }) {
  const { t } = useTranslation();
  const low = list.filter((r) => r.stock_state === 'low').length;
  const out = list.filter((r) => r.stock_state === 'out').length;
  const meta = [t('catalog.list.groupItems', { n: list.length })];
  if (low > 0) meta.push(t('catalog.list.groupLow', { k: low }));
  if (out > 0) meta.push(t('catalog.list.groupOut', { h: out }));
  return (
    <>
      <span className="ct-group-meta">{meta.join(' · ')}</span>
      {groupKey !== NO_GROUP && (
        <button type="button" className="btn btn--ghost btn--sm ct-group-add" aria-label={t('catalog.list.addToGroup', { name })} onClick={() => onAdd(groupKey)}>
          <Icon name="plus" size={16} />
          {t('catalog.list.addToGroupShort')}
        </button>
      )}
    </>
  );
}
