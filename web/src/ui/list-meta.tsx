import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// Dòng đếm riêng một hàng đẩy bảng xuống và tách xa bộ lọc sinh ra nó; nằm cuối hàng lọc thì đọc liền với điều kiện lọc
export function ListMeta({ children }: { children: ReactNode }) {
  return <div className="list-meta">{children}</div>;
}

// "Đang hiện x/y" chỉ có nghĩa khi đang lọc/tìm và thật sự bớt dòng; ngoài ra trùng số trên chip "Tất cả" (TN-13)
export function ShownCount({ shown, total, filtering, children }: { shown: number; total: number; filtering: boolean; children: ReactNode }) {
  if (!filtering || shown >= total) return null;
  return (
    <p className="list-count" role="status">
      {children}
    </p>
  );
}

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

// Hàng "Đang lọc" dưới thanh lọc: mỗi điều kiện một chip gỡ được + "Xóa lọc" (TC-10)
export function ActiveFilters({ items, onClearAll, count }: { items: ActiveFilter[]; onClearAll: () => void; count?: ReactNode }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div className="active-filters">
      <span className="active-filters__label">{t('common.filter.activeLabel')}</span>
      {items.map((f) => (
        <button key={f.key} type="button" className="flt-chip active-filters__chip" aria-pressed="true" aria-label={t('common.filter.removeOne', { label: f.label })} onClick={f.onRemove}>
          {f.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="btn btn--ghost btn--sm" onClick={onClearAll}>
        {t('common.filter.clear')}
      </button>
      {count != null && <span className="active-filters__count">{count}</span>}
    </div>
  );
}
