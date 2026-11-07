import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { langOf, lockPhrase } from '@/lib/period-text';
import { usePeriodSummary } from './summary.api';

// Liên kết sang danh sách đăng ký của kỳ đang mở (Tổng hợp kỳ, chỉ xem)
export function OpenRegistrationsLink({ ym, className }: { ym: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <Link className={className} to={`/admin/summary?ym=${ym}`}>
      {t('summary.gate.viewOpen', { month: monthOf(ym) })}
    </Link>
  );
}

// Trang chỉ-kỳ-khóa nói rõ kỳ đang mở xem ở đâu, thay vì đổi tháng âm thầm.
// Tổng hợp kỳ (viewable) xem được kỳ mở nên chỉ mời sang, kèm số đã đăng ký.
export function OpenPeriodNotice({ viewable = false }: { viewable?: boolean }) {
  const { t, i18n } = useTranslation();
  const open = useCurrentPeriod().data;
  const progress = usePeriodSummary(viewable ? open?.ym : undefined).data;
  if (!open) return null;
  const month = monthOf(open.ym);
  const text = viewable
    ? progress
      ? t('summary.gate.openOffer', { month, registered: progress.registered, headcount: progress.headcount })
      : t('summary.gate.openOfferNoCount', { month })
    : t('summary.gate.openNotice', { month, lockPhrase: lockPhrase(open.deadline, langOf(i18n.language)) });
  return (
    <p className="alert" role="status">
      {text} <OpenRegistrationsLink ym={open.ym} />
    </p>
  );
}
