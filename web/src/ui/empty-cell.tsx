import { useTranslation } from 'react-i18next';

// Ô bảng tự vẽ không có giá trị: "—" mờ cho mắt, "Chưa có" cho trình đọc màn hình; dạng thẻ ≤767 ẩn cả ô (td[data-empty])
export function EmptyCell({ className, label }: { className?: string; label: string }) {
  const { t } = useTranslation();
  return (
    <td className={className} data-label={label} data-empty>
      <span aria-hidden="true">{t('common.empty')}</span>
      <span className="sr-only">{t('common.emptyCell')}</span>
    </td>
  );
}
