import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import type { Selection } from '@/ui/data-table-row';
import { Icon } from '@/ui/icon';
import { InlineNumber } from '@/ui/inline-number';
import { useUnitNames } from '@/features/units/units.api';
import { categoryLabel, type Category } from './catalog.api';
import { CodeCell, ItemCell, StockCell, Stop } from './catalog-cells';
import { ItemActiveButton } from './item-active-button';
import { rowErrorText } from './catalog-errors';
import { NO_GROUP, type CatalogRow, type CategoryIndex } from './catalog-rows';

export interface CatalogTableActions {
  onOpen: (id: string) => void;
  onAddToGroup: (categoryId: string) => void;
  onSaveMax: (row: CatalogRow, n: number) => Promise<void>;
  onReactivateGroup: (category: Category) => void;
}

interface Props extends CatalogTableActions {
  rows: CatalogRow[];
  index: CategoryIndex;
  loading: boolean;
  selection: Selection;
  rowErrors: Record<string, string>;
  groupBusy: boolean;
  activeRowId?: string;
  collapsed: ReadonlySet<string>;
  onCollapsedChange: (next: ReadonlySet<string>) => void;
  empty: { hint: string; action: ReactNode };
}

// flexRender coi hàm cell là component: cột đổi danh tính thì mọi ô bị dựng lại, ô đang sửa mất số đang gõ
function useColumns(rowErrors: Record<string, string>, actions: CatalogTableActions, index: CategoryIndex) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  const latest = useRef({ rowErrors, actions, index });
  latest.current = { rowErrors, actions, index };
  return useMemo<ColumnDef<CatalogRow, unknown>[]>(() => {
    const onOpen = (id: string) => latest.current.actions.onOpen(id);
    const onSaveMax = (row: CatalogRow, n: number) => latest.current.actions.onSaveMax(row, n);
    const columns: ColumnDef<CatalogRow, unknown>[] = [
      { id: 'code', header: t('catalog.list.colCode'), meta: { className: 'ct-code' }, cell: ({ row }) => <CodeCell code={row.original.code} /> },
      { id: 'item', header: t('catalog.list.colItem'), meta: { className: 'ct-item-cell' }, cell: ({ row }) => <ItemCell row={row.original} error={latest.current.rowErrors[row.original.id]} /> },
      { id: 'nameEn', header: t('catalog.list.colNameEn'), meta: { className: 'ct-name-en' }, cell: ({ row }) => row.original.name_en ?? <span className="ct-name-en__empty">{t('common.empty')}</span> },
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
          <Stop className="ct-active">
            <ItemActiveButton row={r} name={r.name} groupActive={latest.current.index.byId.get(r.group)?.active ?? true} quietHint />
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
  }, [t, unitName]);
}

export function CatalogTable({ rows, index, loading, selection, rowErrors, groupBusy, activeRowId, collapsed, onCollapsedChange, empty, ...actions }: Props) {
  const { t, i18n } = useTranslation();
  const columns = useColumns(rowErrors, actions, index);
  const groupName = (key: string) => {
    const cat = index.byId.get(key);
    return cat ? categoryLabel(cat, i18n.language) : t('catalog.page.noCategory');
  };
  const stopped = (key: string) => index.byId.get(key)?.active === false;
  return (
    <DataTable
      data={rows}
      columns={columns}
      stackOnMobile
      loading={loading}
      selection={selection}
      activeRowId={activeRowId}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      onRowClick={(r) => actions.onOpen(r.id)}
      rowClassName={(r) => [r.usable ? '' : 'is-inactive', rowErrors[r.id] ? 'has-error' : ''].filter(Boolean).join(' ')}
      emptyText={t('catalog.list.emptyTitle')}
      empty={{ art: 'no-match', ...empty }}
      groupBy={{
        key: (r) => r.group,
        header: (key, list) => (
          <span className="ct-group" data-tone={list[0]?.tone ?? 'g0'}>
            <span className="ct-group__thumb" aria-hidden="true">
              <Icon name="pkg" size={16} />
            </span>
            <span className={stopped(key) ? 'ct-group__name ct-group__name--stopped' : 'ct-group__name'}>{groupName(key)}</span>
            {stopped(key) && <span className="ct-group__stopped">{t('catalog.grid.groupStopped')}</span>}
          </span>
        ),
        aside: (key, list) => (
          <GroupAside groupKey={key} name={groupName(key)} list={list} category={index.byId.get(key)} busy={groupBusy} onAdd={actions.onAddToGroup} onReactivate={actions.onReactivateGroup} />
        ),
      }}
    />
  );
}

interface AsideProps {
  groupKey: string;
  name: string;
  list: CatalogRow[];
  category: Category | undefined;
  busy: boolean;
  onAdd: (id: string) => void;
  onReactivate: (category: Category) => void;
}

function GroupAside({ groupKey, name, list, category, busy, onAdd, onReactivate }: AsideProps) {
  const { t } = useTranslation();
  return (
    <>
      <span className="ct-group-meta">{t('catalog.list.groupItems', { n: list.length })}</span>
      {groupKey === NO_GROUP ? (
        <span className="ct-icon-btn" aria-hidden="true" />
      ) : category?.active === false ? (
        <Stop>
          <button type="button" className="btn btn--sm btn--primary" disabled={busy} aria-label={t('catalog.categories.reactivateFor', { name })} onClick={() => onReactivate(category)}>
            {t('catalog.grid.reactivateGroup')}
          </button>
        </Stop>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm ct-icon-btn ct-group-add" aria-label={t('catalog.list.addToGroup', { name })} title={t('catalog.list.addToGroup', { name })} onClick={() => onAdd(groupKey)}>
          <Icon name="plus" size={18} />
        </button>
      )}
    </>
  );
}
