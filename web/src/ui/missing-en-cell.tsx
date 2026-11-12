import { useTranslation } from 'react-i18next';

// Ô "Tên tiếng Anh" trống ở Nhóm món / ĐVT: báo "Thiếu tên EN" thay "—", vì thiếu tên này thì giao diện EN
// của nhân viên hiện chữ Việt (chip nhóm, ĐVT). Chỉ nhắc, không chặn lưu: name_en vẫn tùy chọn
export function MissingEnCell({ className, label }: { className?: string; label: string }) {
  const { t } = useTranslation();
  return (
    <td className={className} data-label={label}>
      <span className="tag tag--warn" title={t('common.missingEnHint')}>
        {t('common.missingEn')}
      </span>
    </td>
  );
}
