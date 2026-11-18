import { useTranslation } from 'react-i18next';

// Một dòng, không kể tên: tên đã có trên bảng (dòng vạch cam); nợ tháng trước xem ở Còn nợ trên sidebar
export function MonthLeftReminder({ count, onFilter }: { count: number; onFilter: () => void }) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <div className="alert alert--warn mk-left">
      <span>{t('month.left.banner', { count })}</span>
      <button type="button" className="btn btn--sm" onClick={onFilter}>
        {t('month.left.action', { count })}
      </button>
    </div>
  );
}
