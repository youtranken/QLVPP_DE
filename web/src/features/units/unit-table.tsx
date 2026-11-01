import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { RowMenu, type RowMenuItem } from '@/ui/row-menu';
import type { AdminUnit } from './units.api';

interface Props {
  ordered: AdminUnit[];
  busy: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onEdit: (u: AdminUnit) => void;
  onToggleActive: (u: AdminUnit) => void;
  onDelete: (u: AdminUnit) => void;
}

export function UnitTable({ ordered, busy, onMove, onEdit, onToggleActive, onDelete }: Props) {
  const { t } = useTranslation();
  const menuItems = (u: AdminUnit): RowMenuItem[] => [
    { label: t('units.page.edit'), onSelect: () => onEdit(u) },
    { label: t(u.active ? 'units.page.deactivate' : 'units.page.reactivate'), disabled: busy, onSelect: () => onToggleActive(u) },
    ...(u.in_use ? [] : [{ label: t('units.page.delete'), disabled: busy, danger: true, onSelect: () => onDelete(u) }]),
  ];
  return (
    <div className="table-wrap">
      <table className="table table-stack un-table">
        <thead>
          <tr>
            <th>{t('units.page.colOrder')}</th>
            <th>{t('units.page.colName')}</th>
            <th>{t('units.page.colNameEn')}</th>
            <th className="num r">{t('units.page.colItems')}</th>
            <th>{t('units.page.colStatus')}</th>
            <th>
              <span className="sr-only">{t('units.page.colActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((u, i) => (
            <tr key={u.code} className={u.active ? undefined : 'is-inactive'}>
              <td className="un-order">
                <span className="ord-ctl">
                  <button type="button" className="ord-ctl__btn" aria-label={t('units.page.moveUp', { name: u.name })} disabled={busy || i === 0} onClick={() => onMove(i, -1)}>
                    <Icon name="chevup" size={16} />
                  </button>
                  <button type="button" className="ord-ctl__btn" aria-label={t('units.page.moveDown', { name: u.name })} disabled={busy || i === ordered.length - 1} onClick={() => onMove(i, 1)}>
                    <Icon name="chev" size={16} />
                  </button>
                  <span className="num ord-ctl__n">{i + 1}</span>
                </span>
              </td>
              <td className="un-name">
                <span className="un-name__text">{u.name}</span>
              </td>
              <td className="un-name-en" data-label={t('units.page.colNameEn')}>
                <span>{u.name_en ?? t('common.empty')}</span>
              </td>
              <td className="num r" data-label={t('units.page.colItems')}>
                {u.item_count}
              </td>
              <td data-label={t('units.page.colStatus')}>
                <span className={u.active ? 'tag tag--ok' : 'tag tag--outline'}>{t(u.active ? 'units.page.active' : 'units.page.inactive')}</span>
              </td>
              <td className="un-menu">
                <RowMenu label={t('units.page.menu', { name: u.name })} items={menuItems(u)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
