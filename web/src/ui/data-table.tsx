import { Fragment, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { fixedMinWidth } from './fixed-min-width';
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
import { Loading } from '@/ui/load-state';
import { EmptyFrame, type EmptyFrameProps } from '@/ui/empty-frame';
import { GroupHeaderRow, type GroupBy, type RowGroup } from '@/ui/data-table-group';
import { cellClass } from '@/ui/cell-class';
import { BodyRow, EmptyAwareCell, SelectBox, type RowProps, type Selection } from '@/ui/data-table-row';
import { SearchClear } from '@/ui/search-clear';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
    tip?: string;
    label?: string;
    // Bề rộng cột cố định (vd '12%', '56px'): có ở bất kỳ cột nào → bảng table-layout: fixed, cột không đổi chỗ khi đổi tab/lọc.
    // Cột chữ chính để trống → nhận phần còn lại
    width?: string;
    // Sàn của cột chữ chính (không đặt width), rem; mặc định 12rem — bảng chạm sàn ở màn vừa thì cột này giữ đúng bề rộng này
    minWidth?: string;
  }
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyText: string;
  // Ô trống của bảng: cùng EmptyFrame với trang (biến thể "no-match" = kính lúp + Xóa lọc)
  empty?: Omit<EmptyFrameProps, 'title' | 'flush'>;
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
  ariaLabel?: string;
  busy?: boolean;
  collapsed?: ReadonlySet<string>;
  onCollapsedChange?: (next: ReadonlySet<string>) => void;
  expandedRow?: (row: T) => ReactNode;
  rowProps?: (row: T) => RowProps;
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
  ariaLabel,
  busy,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  expandedRow,
  rowProps,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  // Thu/mở nhóm chỉ có khi trang tự quản (Sản phẩm thu sẵn nhóm tạm ngưng); bảng khác không có nút thu/mở (TN-11)
  const collapsed = controlledCollapsed ?? NONE;
  const setCollapsed = onCollapsedChange;
  const [internalSort, setInternalSort] = useState<SortingState>(initialSort);
  const [globalFilter, setGlobalFilter] = useState('');
  const sorting = controlledSorting ?? internalSort;
  const onSortingChange = controlledOnSortingChange ?? setInternalSort;

  const table = useReactTable({
    data,
    columns,
    defaultColumn: { cell: EmptyAwareCell },
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
  const leafColumns = table.getVisibleLeafColumns();
  const fixed = leafColumns.some((c) => c.columnDef.meta?.width);
  const colSpan = leafColumns.length + (selection ? 1 : 0);
  const groups = groupBy ? groupRows(rows, groupBy.key) : null;
  // Chọn tất cả chỉ lấy hàng đang thấy: nhóm đang thu thì người dùng không biết mình chọn món nào
  const selectable = groupBy ? rows.filter((r) => !collapsed.has(groupBy.key(r.original))) : rows;
  const picked = selection ? selectable.filter((r) => selection.selected.has(r.id)).length : 0;
  // Mọi nhóm đang thu thì không còn cột nào để đọc: ẩn đầu bảng cho gọn
  const headHidden = (rows.length === 0 && !loading) || (groups !== null && groups.length > 0 && groups.every((g) => collapsed.has(g.key)));
  const toggleGroup = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed?.(next);
  };
  const bodyRow = (row: Row<T>) => {
    const extra = expandedRow?.(row.original);
    return (
      <Fragment key={row.id}>
        <BodyRow
          row={row}
          active={row.id === activeRowId}
          selection={selection}
          onRowClick={onRowClick}
          className={rowClassName?.(row.original)}
          extra={rowProps?.(row.original)}
        />
        {extra != null && (
          <tr className="dt-expanded">
            <td colSpan={colSpan}>{extra}</td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <>
      {searchPlaceholder !== undefined && (
        <SearchBox onChange={setGlobalFilter} placeholder={searchPlaceholder} />
      )}
      <div className="table-wrap">
        <table
          className={['table', tableClassName, stackOnMobile ? 'table-stack' : '', fixed ? 'table--fixed' : '']
            .filter(Boolean)
            .join(' ')}
          data-density={density}
          aria-label={ariaLabel}
          aria-busy={busy}
          style={fixed ? ({ '--dt-min': `${fixedMinWidth(leafColumns.map((c) => c.columnDef.meta?.width), !!selection, leafColumns.map((c) => c.columnDef.meta?.minWidth))}rem` } as CSSProperties) : undefined}
        >
          {fixed && (
            <colgroup>
              {selection && <col className="sel" />}
              {leafColumns.map((c) => (
                <col key={c.id} style={c.columnDef.meta?.width ? { width: c.columnDef.meta.width } : undefined} />
              ))}
            </colgroup>
          )}
          <thead hidden={headHidden}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {selection && (
                  <th className="sel">
                    <SelectBox
                      label={t('common.selectAll')}
                      checked={selectable.length > 0 && picked === selectable.length}
                      indeterminate={picked > 0 && picked < selectable.length}
                      onChange={(checked) =>
                        selection.onToggleAll(
                          selectable.map((r) => r.id),
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
                      className={cellClass(h.column.id, hm?.className)}
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
                  {loading ? <Loading /> : <EmptyFrame flush title={emptyText} {...empty} />}
                </td>
              </tr>
            ) : groups && groupBy ? (
              groups.map((g) => (
                <Fragment key={g.key}>
                  <GroupHeaderRow
                    group={g}
                    groupBy={groupBy}
                    colSpan={colSpan}
                    expanded={!collapsed.has(g.key)}
                    onToggleExpanded={setCollapsed ? () => toggleGroup(g.key) : undefined}
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

const NONE: ReadonlySet<string> = new Set();

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
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => onChange(text), 200);
    return () => clearTimeout(id);
  }, [text, onChange]);
  return (
    <span className="search-wrap table-search-wrap">
      <input
        ref={ref}
        className="table-search"
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
      />
      <SearchClear className="search-box-x" value={text} onClear={() => setText('')} inputRef={ref} />
    </span>
  );
}
