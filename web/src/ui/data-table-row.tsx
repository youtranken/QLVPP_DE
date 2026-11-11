import { useEffect, useRef, type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { flexRender, type Row } from '@tanstack/react-table';

export interface Selection {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}

export function SelectBox({
  checked,
  indeterminate = false,
  label,
  labelledBy,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      aria-labelledby={labelledBy}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export type RowProps = Pick<HTMLAttributes<HTMLTableRowElement>, 'tabIndex' | 'aria-expanded' | 'aria-controls' | 'onClick' | 'onKeyDown'>;

export function BodyRow<T>({
  row,
  active,
  selection,
  onRowClick,
  className,
  extra,
}: {
  row: Row<T>;
  active: boolean;
  selection?: Selection;
  onRowClick?: (row: T) => void;
  className?: string;
  extra?: RowProps;
}) {
  const { t } = useTranslation();
  return (
    <tr
      {...extra}
      className={[onRowClick || extra?.onClick ? 'clickable' : '', className || ''].filter(Boolean).join(' ') || undefined}
      aria-current={active ? 'true' : undefined}
      // Không role=button (dòng có thể chứa nút); dòng mở bằng bàn phím tự gắn tabIndex/onKeyDown/aria-describedby qua extra
      onClick={onRowClick ? () => onRowClick(row.original) : extra?.onClick}
    >
      {selection && (
        <td className="sel" onClick={(e) => e.stopPropagation()}>
          <SelectBox
            label={t('common.selectRow')}
            checked={selection.selected.has(row.id)}
            onChange={() => selection.onToggle(row.id)}
          />
        </td>
      )}
      {row.getVisibleCells().map((cell) => {
        const h = cell.column.columnDef.header;
        const label = cell.column.columnDef.meta?.label ?? (typeof h === 'string' ? h : '');
        // B0.19: cột dữ liệu dùng ô mặc định (không tự vẽ) mà không có giá trị → "—" + chữ ẩn "Chưa có".
        // Ô tự vẽ trả null thì CSS (table.css) vẽ "—" ở dạng bảng; cột không tên (nút, icon) để trống như cũ
        const defaultCell = cell.column.columnDef.cell === cell.getContext().table._getDefaultColumnDef().cell;
        const value = defaultCell && cell.column.accessorFn ? cell.getValue() : 0;
        const blank = label !== '' && (value === null || value === undefined || value === '');
        const content = blank ? null : flexRender(cell.column.columnDef.cell, cell.getContext());
        return (
          <td key={cell.id} className={cell.column.columnDef.meta?.className} data-label={label} data-empty={blank || undefined}>
            {blank ? (
              <>
                <span aria-hidden="true">{t('common.empty')}</span>
                <span className="sr-only">{t('common.emptyCell')}</span>
              </>
            ) : (
              content
            )}
          </td>
        );
      })}
    </tr>
  );
}
