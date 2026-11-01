import { useTranslation } from 'react-i18next';
import { toneAtRank } from '@/lib/group-tone';
import { Icon } from '@/ui/icon';
import { RowMenu } from '@/ui/row-menu';
import type { Category } from './catalog.api';

interface Props {
  ordered: Category[];
  counts: Map<string, number>;
  busy: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onEdit: (c: Category) => void;
  onToggleActive: (c: Category) => void;
  // Hộp "Ngừng nhóm" báo số món sẽ ẩn: chưa tải được món thì không cho mở (tránh "0 món")
  countsReady: boolean;
}

export function CategoryTable({ ordered, counts, countsReady, busy, onMove, onEdit, onToggleActive }: Props) {
  const { t } = useTranslation();
  return (
    <div className="table-wrap">
      <table className="table table-stack cg-table">
        <thead>
          <tr>
            <th>{t('catalog.categories.colOrder')}</th>
            <th>{t('catalog.categories.colTone')}</th>
            <th>{t('catalog.categories.colName')}</th>
            <th>{t('catalog.categories.colNameEn')}</th>
            <th className="num r">{t('catalog.categories.colItems')}</th>
            <th>{t('catalog.categories.colStatus')}</th>
            <th>
              <span className="sr-only">{t('catalog.categories.colActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((c, i) => {
            const tone = toneAtRank(i);
            return (
              <tr key={c.id} className={c.active ? undefined : 'is-inactive'}>
                <td className="cg-order">
                  <span className="ord-ctl">
                    <button type="button" className="ord-ctl__btn" aria-label={t('catalog.categories.moveUp', { name: c.name })} disabled={busy || i === 0} onClick={() => onMove(i, -1)}>
                      <Icon name="chevup" size={16} />
                    </button>
                    <button type="button" className="ord-ctl__btn" aria-label={t('catalog.categories.moveDown', { name: c.name })} disabled={busy || i === ordered.length - 1} onClick={() => onMove(i, 1)}>
                      <Icon name="chev" size={16} />
                    </button>
                    <span className="num ord-ctl__n">{i + 1}</span>
                  </span>
                </td>
                <td className="cg-tone-cell">
                  <span className="ct-dot cg-dot" style={{ background: `var(--${tone}-ink)` }} title={t(`catalog.tones.${tone}`)} />
                </td>
                <td className="cg-name">
                  <span className="cg-name__text">{c.name}</span>
                </td>
                <td className="cg-name-en" data-label={t('catalog.categories.colNameEn')}>
                  <span>{c.name_en ?? t('common.empty')}</span>
                </td>
                <td className="num r" data-label={t('catalog.categories.colItems')}>
                  {counts.get(c.id) ?? 0}
                </td>
                <td data-label={t('catalog.categories.colStatus')}>
                  <span className={c.active ? 'tag tag--ok' : 'tag tag--outline'}>{t(c.active ? 'catalog.categories.active' : 'catalog.categories.inactive')}</span>
                </td>
                <td className="cg-menu">
                  <RowMenu
                    label={t('catalog.categories.menu', { name: c.name })}
                    items={[
                      { label: t('catalog.categories.edit'), onSelect: () => onEdit(c) },
                      { label: t(c.active ? 'catalog.categories.deactivate' : 'catalog.categories.reactivate'), disabled: busy || (c.active && !countsReady), danger: c.active, onSelect: () => onToggleActive(c) },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
