import { useDisabledReason } from '@/ui/disabled-reason';
import { useTranslation } from 'react-i18next';
import { MissingEnCell } from '@/ui/missing-en-cell';
import { ReorderCell, ReorderHead } from '@/ui/reorder';
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
  // Ô tìm chỉ ẩn hàng, không bỏ khỏi danh sách: thứ tự sắp xếp tính trên toàn bộ
  visible?: (u: AdminUnit) => boolean;
}

export function UnitTable({ ordered, busy, sorting, onMove, onMoveTo, onEdit, onToggleActive, onDelete, visible }: Props) {
  const { t } = useTranslation();
  const lock = useDisabledReason(sorting ? t('common.disabledReason.sorting') : null);
  const drag = useRowDrag(onMoveTo);
  return (
    <div className="table-wrap">
      <table className={`table table-stack table--fixed un-table${sorting ? ' is-sorting' : ''}`}>
        {/* Bề rộng cột cố định như bảng Nhóm: lọc theo tên không làm cột nhảy chỗ; tên nhận phần còn lại */}
        <colgroup>
          {sorting && <col className="un-col-reorder" />}
          <col />
          <col className="un-col-en" />
          <col className="un-col-items" />
          <col className="un-col-acts" />
        </colgroup>
        <thead>
          <tr>
            {sorting && <ReorderHead />}
            <th>{t('units.page.colName')}</th>
            <th>{t('units.page.colNameEn')}</th>
            <th className="num r">{t('units.page.colItems')}</th>
            <th className="acts">
              <span className="sr-only">{t('units.page.colActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((u, i) => {
            if (visible && !visible(u)) return null;
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
                  <MissingEnCell className="un-name-en" label={t('units.page.colNameEn')} />
                )}
                <td className="num r un-count" data-label={t('units.page.colItems')}>
                  {u.item_count}
                </td>
                <td className="acts">
                  {/* Cùng mẫu nút chữ với tab Nhóm (Sửa · Tạm ngưng/Dùng lại), thêm Xóa khi chưa món nào dùng */}
                  <div className="acts__in">
                    <button type="button" className="btn btn--sm" aria-label={t('units.page.editFor', { name: u.name })} disabled={sorting} aria-describedby={lock.describedBy} onClick={() => onEdit(u)}>
                      {t('units.page.edit')}
                    </button>
                    {u.active ? (
                      <button type="button" className="btn btn--sm btn--danger-line" aria-label={t('units.page.deactivateFor', { name: u.name })} disabled={busy || sorting} aria-describedby={lock.describedBy} onClick={() => onToggleActive(u)}>
                        {t('units.page.deactivate')}
                      </button>
                    ) : (
                      <button type="button" className="btn btn--sm btn--primary" aria-label={t('units.page.reactivateFor', { name: u.name })} disabled={busy || sorting} aria-describedby={lock.describedBy} onClick={() => onToggleActive(u)}>
                        {t('units.page.reactivate')}
                      </button>
                    )}
                    {!u.in_use && (
                      <button type="button" className="btn btn--sm btn--danger-line" aria-label={t('units.page.deleteFor', { name: u.name })} disabled={busy || sorting} aria-describedby={lock.describedBy} onClick={() => onDelete(u)}>
                        {t('units.page.delete')}
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
