import { useTranslation } from 'react-i18next';
import { toneAtRank } from '@/lib/group-tone';
import { ReorderCell, ReorderHead } from '@/ui/reorder';
import { RowMenu } from '@/ui/row-menu';
import { useRowDrag } from '@/ui/use-row-drag';
import type { Category } from './catalog.api';

interface Props {
  ordered: Category[];
  counts: Map<string, number>;
  busy: boolean;
  sorting: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onMoveTo: (from: number, to: number) => void;
  onEdit: (c: Category) => void;
  onToggleActive: (c: Category) => void;
  // Hộp "Ngừng nhóm" báo số món sẽ ẩn: chưa tải được món thì không cho mở (tránh "0 món")
  countsReady: boolean;
}

export function CategoryTable({ ordered, counts, countsReady, busy, sorting, onMove, onMoveTo, onEdit, onToggleActive }: Props) {
  const { t } = useTranslation();
  const drag = useRowDrag(onMoveTo);
  return (
    <div className="table-wrap">
      <table className={`table table-stack cg-table${sorting ? ' is-sorting' : ''}`}>
        <thead>
          <tr>
            {sorting && <ReorderHead />}
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
            const dragProps = sorting ? drag(i) : undefined;
            return (
              <tr key={c.id} {...dragProps} className={[c.active ? '' : 'is-inactive', dragProps?.className ?? ''].filter(Boolean).join(' ') || undefined}>
                {sorting && <ReorderCell index={i} count={ordered.length} name={c.name} disabled={busy} onMove={onMove} />}
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
