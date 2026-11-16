// Cột thao tác (Xem, Giao…, Sửa) dính mép phải khi bảng cuộn ngang ở màn vừa
const ACTION_COLUMNS = new Set(['actions', 'action', 'edit']);
export function cellClass(columnId: string, className?: string): string | undefined {
  return ACTION_COLUMNS.has(columnId) ? [className, 'col-actions'].filter(Boolean).join(' ') : className;
}
