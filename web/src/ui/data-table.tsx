import { Fragment, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { EmptyState, Loading } from '@/ui/load-state';
import type { EmptyArtKind } from '@/ui/empty-art';
import { GroupHeaderRow, type GroupBy, type RowGroup } from '@/ui/data-table-group';
import { BodyRow, SelectBox, type Selection } from '@/ui/data-table-row';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
    tip?: string;
  }
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyText: string;
  empty?: { art?: EmptyArtKind; hint?: string; action?: ReactNode };
  loading?: boolean;
  searchPlaceholder?: string;
  initialSort?: SortingState;
  rowClassName?: (row: T) => string;
  tableClassName?: string;
  manualSorting?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  onRowClick?: (row: T) => void;
  stackOnMobile?: boolean;
  selection?: Selection;
  groupBy?: GroupBy<T>;
  activeRowId?: string;
  density?: 'compact';
  busy?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  emptyText,
  empty,
  loading,
  searchPlaceholder,
  initialSort = [],
  rowClassName,
  tableClassName,
  manualSorting,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  onRowClick,
  stackOnMobile,
  selection,
  groupBy,
  activeRowId,
  density,
  busy,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [internalSort, setInternalSort] = useState<SortingState>(initialSort);
  const [globalFilter, setGlobalFilter] = useState('');
  const sorting = controlledSorting ?? internalSort;
  const onSortingChange = controlledOnSortingChange ?? setInternalSort;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange,
    onGlobalFilterChange: setGlobalFilter,
    // TanStack mặc định sắp cột số desc trước — khó đoán, ép asc trước cho mọi cột
    sortDescFirst: false,
    globalFilterFn: 'includesString',
    manualSorting: manualSorting ?? false,
    getRowId: (row, index) => {
      const r = row as { id?: string | number };
      return r.id != null ? String(r.id) : String(index);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const colSpan = table.getAllLeafColumns().length + (selection ? 1 : 0);
  const picked = selection ? rows.filter((r) => selection.selected.has(r.id)).length : 0;
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const bodyRow = (row: Row<T>) => (
    <BodyRow
      key={row.id}
      row={row}
      active={row.id === activeRowId}
      selection={selection}
      onRowClick={onRowClick}
      className={rowClassName?.(row.original)}
    />
  );

  return (
    <>
      {searchPlaceholder !== undefined && (
        <SearchBox onChange={setGlobalFilter} placeholder={searchPlaceholder} />
      )}
      <div className="table-wrap">
        <table
          className={['table', tableClassName, stackOnMobile ? 'table-stack' : '']
            .filter(Boolean)
            .join(' ')}
          data-density={density}
          aria-busy={busy}
        >
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {selection && (
                  <th className="sel">
                    <SelectBox
                      label={t('common.selectAll')}
                      checked={rows.length > 0 && picked === rows.length}
                      indeterminate={picked > 0 && picked < rows.length}
                      onChange={(checked) =>
                        selection.onToggleAll(
                          rows.map((r) => r.id),
                          checked,
                        )
                      }
                    />
                  </th>
                )}
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const hm = h.column.columnDef.meta;
                  return (
                    <th
                      key={h.id}
                      className={hm?.className}
                      title={hm?.tip}
                      aria-sort={
                        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                      }
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          className="th-sort"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span aria-hidden="true" className="sort-arrow">
                            {sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ''}
                          </span>
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  {loading ? <Loading /> : <EmptyState title={emptyText} {...empty} />}
                </td>
              </tr>
            ) : groupBy ? (
              groupRows(rows, groupBy.key).map((g) => (
                <Fragment key={g.key}>
                  <GroupHeaderRow
                    group={g}
                    groupBy={groupBy}
                    colSpan={colSpan}
                    expanded={!collapsed.has(g.key)}
                    onToggleExpanded={() => toggleGroup(g.key)}
                    selection={selection}
                  />
                  {!collapsed.has(g.key) && g.rows.map(bodyRow)}
                </Fragment>
              ))
            ) : (
              rows.map(bodyRow)
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function groupRows<T>(rows: Row<T>[], keyOf: (row: T) => string): RowGroup<T>[] {
  const groups = new Map<string, Row<T>[]>();
  for (const row of rows) {
    const k = keyOf(row.original);
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  return [...groups].map(([key, list]) => ({ key, rows: list }));
}

// Debounce 200 ms để không lọc lại mỗi phím trên bảng lớn
function SearchBox({ onChange, placeholder }: { onChange: (v: string) => void; placeholder: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const id = setTimeout(() => onChange(text), 200);
    return () => clearTimeout(id);
  }, [text, onChange]);
  return (
    <input
      className="table-search"
      type="search"
      value={text}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setText(e.target.value)}
    />
  );
}
