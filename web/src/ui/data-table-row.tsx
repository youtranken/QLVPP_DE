import { useEffect, useRef } from 'react';
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
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label?: string;
  labelledBy?: string;
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
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function BodyRow<T>({
  row,
  active,
  selection,
  onRowClick,
  className,
}: {
  row: Row<T>;
  active: boolean;
  selection?: Selection;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <tr
      className={[onRowClick ? 'clickable' : '', className || ''].filter(Boolean).join(' ') || undefined}
      aria-current={active ? 'true' : undefined}
      // Bấm dòng chỉ là tiện ích chuột; không role=button vì dòng chứa nút (nested-interactive)
      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
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
  );
}
