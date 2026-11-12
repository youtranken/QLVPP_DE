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

// Giá trị trống bên trong một ô/cặp nhãn đã có sẵn (ô tự dựng, <dd>, ô Ghi chú): cùng "—" mờ + "Chưa có" cho trình đọc.
// Có nhãn mà không giá trị đọc như lỗi tải, nên mọi chỗ trống đều đi qua đây
export function EmptyValue() {
  const { t } = useTranslation();
  return (
    <>
      <span className="sm-muted" aria-hidden="true">
        {t('common.empty')}
      </span>
      <span className="sr-only">{t('common.emptyCell')}</span>
    </>
  );
}
