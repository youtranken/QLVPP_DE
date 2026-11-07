import { useTranslation } from 'react-i18next';

interface Props {
  name: string;
  count: number;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onReactivate: () => void;
}

// Nhóm tạm ngưng ở lưới: một dòng thu gọn, tên gạch + nhãn đỏ, không nút "+"
export function StoppedGroupRow({ name, count, expanded, busy, onToggle, onReactivate }: Props) {
  const { t } = useTranslation();
  return (
    <div className="ct-stopped">
      <h2 className="ct-section__title ct-stopped__name">{name}</h2>
      <span className="ct-stopped__label">{t('catalog.grid.groupStopped')}</span>
      <span className="ct-stopped__meta">{t(expanded ? 'catalog.list.groupItems' : 'catalog.grid.groupCollapsed', { n: count })}</span>
      <span className="ct-stopped__acts">
        <button type="button" className="btn btn--sm" aria-expanded={expanded} onClick={onToggle}>
          {t(expanded ? 'catalog.grid.hideGroup' : 'catalog.grid.showGroup', { n: count })}
        </button>
        <button type="button" className="btn btn--sm btn--primary" disabled={busy} aria-label={t('catalog.categories.reactivateFor', { name })} onClick={onReactivate}>
          {t('catalog.grid.reactivateGroup')}
        </button>
      </span>
    </div>
  );
}
