import { useTranslation } from 'react-i18next';
// paused-stamp.css nạp ở main.tsx (thẻ dùng ở cả chunk nhân viên lẫn Hành chính: import ở đây thì CSS bị tách ra file riêng, lệch thứ tự)

export function PausedStamp({ label }: { label?: string }) {
  const { t } = useTranslation();
  const text = label ?? t('common.paused');
  return (
    <span className="paused-stamp" role="img" aria-label={text}>
      {text}
    </span>
  );
}
