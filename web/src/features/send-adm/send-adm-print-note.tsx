import { useTranslation } from 'react-i18next';

// Ngay dưới nút In: nút này chỉ in tờ trình ký, và nhắc chỉnh hộp in của trình duyệt
export function PrintNote() {
  const { t } = useTranslation();
  return (
    <p className="sa-print-note">
      <span>{t('reports.page.noAppendix')}</span>
      <span>{t('reports.page.printTip')}</span>
    </p>
  );
}
