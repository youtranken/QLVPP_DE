import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { langOf, lockPhrase } from '@/lib/period-text';

// Trang chỉ-kỳ-khóa nói rõ kỳ đang mở không xem được đến khi nào, thay vì đổi tháng âm thầm
export function OpenPeriodNotice() {
  const { t, i18n } = useTranslation();
  const open = useCurrentPeriod().data;
  if (!open) return null;
  return (
    <p className="alert" role="status">
      {t('summary.gate.openNotice', { month: monthOf(open.ym), lockPhrase: lockPhrase(open.deadline, langOf(i18n.language)) })}{' '}
      <Link to="/admin/home">{t('summary.gate.viewProgress')}</Link>
    </p>
  );
}
