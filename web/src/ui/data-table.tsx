import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { Loading } from '@/ui/load-state';

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
  selection?: {
    selected: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: (ids: string[], checked: boolean) => void;
  };
}

export function DataTable<T>({
  data,
  columns,
  emptyText,
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
}: DataTableProps<T>) {
  const { t } = useTranslation();
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
        >
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {selection && (
                  <th className="sel">
                    <input
                      type="checkbox"
                      aria-label={t('common.selectAll')}
                      checked={rows.length > 0 && rows.every((r) => selection.selected.has(r.id))}
                      onChange={(e) =>
                        selection.onToggleAll(
                          rows.map((r) => r.id),
                          e.target.checked,
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
                  {loading ? <Loading /> : <div className="empty">{emptyText}</div>}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    [onRowClick ? 'clickable' : '', rowClassName?.(row.original) || '']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  // Bấm dòng chỉ là tiện ích chuột; không role=button vì dòng chứa nút (nested-interactive)
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {selection && (
                    <td className="sel" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={t('common.selectRow')}
                        checked={selection.selected.has(row.id)}
                        onChange={() => selection.onToggle(row.id)}
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => {
                    const h = cell.column.columnDef.header;
                    return (
                      <td
                        key={cell.id}
                        className={cell.column.columnDef.meta?.className}
                        data-label={typeof h === 'string' ? h : ''}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
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
