import { useDisabledReason } from '@/ui/disabled-reason';
import { useTranslation } from 'react-i18next';
import { toneAtRank } from '@/lib/group-tone';
import { ReorderCell, ReorderHead } from '@/ui/reorder';
import { useRowDrag } from '@/ui/use-row-drag';
import { MissingEnCell } from '@/ui/missing-en-cell';
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
  onOpen: (c: Category) => void;
  // Hộp "Ngừng nhóm" báo số món sẽ ẩn: chưa tải được món thì không cho mở (tránh "0 món")
  countsReady: boolean;
  // Ô tìm chỉ ẩn hàng, không bỏ khỏi danh sách: màu nhóm theo thứ hạng trong toàn bộ danh sách
  visible?: (c: Category) => boolean;
}

const nameClass = (c: Category) => (c.active ? 'cg-name__text' : 'cg-name__text cg-name--stopped');

export function CategoryTable({ ordered, counts, countsReady, busy, sorting, onMove, onMoveTo, onEdit, onToggleActive, onOpen, visible }: Props) {
  const { t } = useTranslation();
  const lock = useDisabledReason(sorting ? t('common.disabledReason.sorting') : null);
  const drag = useRowDrag(onMoveTo);
  return (
    <div className="table-wrap">
      <table className={`table table-stack table--fixed cg-table${sorting ? ' is-sorting' : ''}`}>
        {/* Bề rộng cột cố định: lọc theo tên không làm cột nhảy chỗ; tên nhóm nhận phần còn lại */}
        <colgroup>
          {sorting && <col className="cg-col-reorder" />}
          <col className="cg-col-tone" />
          <col />
          <col className="cg-col-en" />
          <col className="cg-col-items" />
          <col className="cg-col-acts" />
        </colgroup>
        <thead>
          <tr>
            {sorting && <ReorderHead />}
            <th className="cg-tone-cell">{t('catalog.categories.colTone')}</th>
            <th>{t('catalog.categories.colName')}</th>
            <th>{t('catalog.categories.colNameEn')}</th>
            <th className="num r">{t('catalog.categories.colItems')}</th>
            <th className="acts">
              <span className="sr-only">{t('catalog.categories.colActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((c, i) => {
            if (visible && !visible(c)) return null;
            const tone = toneAtRank(i);
            const dragProps = sorting && !busy ? drag(i) : undefined;
            return (
              <tr key={c.id} {...dragProps} className={[c.active ? '' : 'is-inactive', dragProps?.className ?? ''].filter(Boolean).join(' ') || undefined}>
                {sorting && <ReorderCell index={i} count={ordered.length} name={c.name} disabled={busy} onMove={onMove} />}
                <td className="cg-tone-cell">
                  <span className="ct-dot cg-dot" aria-hidden="true" style={{ background: `var(--${tone}-ink)` }} title={t(`catalog.tones.${tone}`)} />
                </td>
                <td className="cg-name">
                  {sorting ? (
                    <span className={nameClass(c)}>{c.name}</span>
                  ) : (
                    <button type="button" className="cg-open" onClick={() => onOpen(c)}>
                      <span className={nameClass(c)}>{c.name}</span>
                    </button>
                  )}
                  {!c.active && <span className="tag tag--outline cg-stopped">{t('catalog.categories.inactive')}</span>}
                </td>
                {c.name_en ? (
                  <td className="cg-name-en" data-label={t('catalog.categories.colNameEn')}>
                    <span>{c.name_en}</span>
                  </td>
                ) : (
                  <MissingEnCell className="cg-name-en" label={t('catalog.categories.colNameEn')} />
                )}
                <td className="num r" data-label={t('catalog.categories.colItems')}>
                  {sorting ? (
                    counts.get(c.id) ?? 0
                  ) : (
                    <button type="button" className="btn btn--ghost btn--sm cg-count" aria-label={t('catalog.categories.itemsCount', { n: counts.get(c.id) ?? 0 })} onClick={() => onOpen(c)}>
                      {counts.get(c.id) ?? 0}
                    </button>
                  )}
                </td>
                <td className="acts">
                  <div className="acts__in">
                    <button type="button" className="btn btn--sm" aria-label={t('catalog.categories.editFor', { name: c.name })} disabled={sorting} aria-describedby={lock.describedBy} onClick={() => onEdit(c)}>
                      {t('catalog.categories.edit')}
                    </button>
                    {c.active ? (
                      <button type="button" className="btn btn--sm btn--quiet-danger" aria-label={t('catalog.categories.pauseFor', { name: c.name })} disabled={busy || !countsReady || sorting} aria-describedby={lock.describedBy} onClick={() => onToggleActive(c)}>
                        {t('catalog.categories.pause')}
                      </button>
                    ) : (
                      <button type="button" className="btn btn--sm btn--primary" aria-label={t('catalog.categories.reactivateFor', { name: c.name })} disabled={busy || sorting} aria-describedby={lock.describedBy} onClick={() => onToggleActive(c)}>
                        {t('catalog.categories.reactivate')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {lock.node}
    </div>
  );
}
