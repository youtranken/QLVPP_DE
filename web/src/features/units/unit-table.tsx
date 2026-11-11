import { useTranslation } from 'react-i18next';
import { EmptyCell } from '@/ui/empty-cell';
import { ReorderCell, ReorderHead } from '@/ui/reorder';
import { RowMenu, type RowMenuItem } from '@/ui/row-menu';
import { useRowDrag } from '@/ui/use-row-drag';
import type { AdminUnit } from './units.api';

interface Props {
  ordered: AdminUnit[];
  busy: boolean;
  sorting: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onMoveTo: (from: number, to: number) => void;
  onEdit: (u: AdminUnit) => void;
  onToggleActive: (u: AdminUnit) => void;
  onDelete: (u: AdminUnit) => void;
}

export function UnitTable({ ordered, busy, sorting, onMove, onMoveTo, onEdit, onToggleActive, onDelete }: Props) {
  const { t } = useTranslation();
  const drag = useRowDrag(onMoveTo);
  const menuItems = (u: AdminUnit): RowMenuItem[] => [
    { label: t('units.page.edit'), onSelect: () => onEdit(u) },
    { label: t(u.active ? 'units.page.deactivate' : 'units.page.reactivate'), disabled: busy, onSelect: () => onToggleActive(u) },
    ...(u.in_use ? [] : [{ label: t('units.page.delete'), disabled: busy, danger: true, onSelect: () => onDelete(u) }]),
  ];
  return (
    <div className="table-wrap">
      <table className={`table table-stack un-table${sorting ? ' is-sorting' : ''}`}>
        <thead>
          <tr>
            {sorting && <ReorderHead />}
            <th>{t('units.page.colName')}</th>
            <th>{t('units.page.colNameEn')}</th>
            <th className="num r">{t('units.page.colItems')}</th>
            <th>
              <span className="sr-only">{t('units.page.colActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((u, i) => {
            const dragProps = sorting && !busy ? drag(i) : undefined;
            const cls = [u.active ? '' : 'is-inactive', dragProps?.className ?? ''].filter(Boolean).join(' ') || undefined;
            return (
              <tr key={u.code} {...dragProps} className={cls}>
                {sorting && <ReorderCell index={i} count={ordered.length} name={u.name} disabled={busy} onMove={onMove} />}
                <td className="un-name">
                  <span className="un-name__text">{u.name}</span>
                  {!u.active && <span className="tag tag--outline">{t('units.page.inactive')}</span>}
                </td>
                {u.name_en ? (
                  <td className="un-name-en" data-label={t('units.page.colNameEn')}>
                    <span>{u.name_en}</span>
                  </td>
                ) : (
                  <EmptyCell className="un-name-en" label={t('units.page.colNameEn')} />
                )}
                <td className="num r un-count" data-label={t('units.page.colItems')}>
                  {u.item_count}
                </td>
                <td className="un-menu acts">
                  <div className="acts__in">
                    <RowMenu label={t('units.page.menu', { name: u.name })} items={menuItems(u)} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
