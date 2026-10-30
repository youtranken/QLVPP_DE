import { useId } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Row } from '@tanstack/react-table';
import { Icon } from '@/ui/icon';
import { SelectBox } from '@/ui/data-table-row';

export interface GroupBy<T> {
  key: (row: T) => string;
  header: (groupKey: string, rows: T[]) => ReactNode;
}

export interface RowGroup<T> {
  key: string;
  rows: Row<T>[];
}

export function GroupHeaderRow<T>({
  group,
  groupBy,
  colSpan,
  expanded,
  onToggleExpanded,
  selection,
}: {
  group: RowGroup<T>;
  groupBy: GroupBy<T>;
  colSpan: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  selection?: { selected: Set<string>; onToggleAll: (ids: string[], checked: boolean) => void };
}) {
  const { t } = useTranslation();
  const id = useId();
  const ids = group.rows.map((r) => r.id);
  const picked = selection ? ids.filter((i) => selection.selected.has(i)).length : 0;
  const selectLabelIds = `${id}-sel ${id}-title`;
  const toggleLabelIds = `${id}-btn ${id}-title`;
  return (
    <tr className="dt-group">
      <th scope="rowgroup" colSpan={colSpan}>
        <div className="dt-group__inner">
          {selection && (
            <>
              <span id={`${id}-sel`} hidden>
                {t('common.table.selectGroup')}
              </span>
              <SelectBox
                checked={picked > 0 && picked === ids.length}
                indeterminate={picked > 0 && picked < ids.length}
                labelledBy={selectLabelIds}
                onChange={(checked) => selection.onToggleAll(ids, checked)}
              />
            </>
          )}
          <span id={`${id}-title`} className="dt-group__title">
            {groupBy.header(group.key, group.rows.map((r) => r.original))}
          </span>
          <button
            type="button"
            id={`${id}-btn`}
            className="dt-group__toggle"
            aria-expanded={expanded}
            aria-labelledby={toggleLabelIds}
            onClick={onToggleExpanded}
          >
            <span className="sr-only">{t('common.table.toggleGroup')}</span>
            <Icon name={expanded ? 'chevup' : 'chev'} size={18} />
          </button>
        </div>
      </th>
    </tr>
  );
}
