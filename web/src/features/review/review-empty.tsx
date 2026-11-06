import { useTranslation } from 'react-i18next';
import { langOf, lockPhrase } from '@/lib/period-text';
import { lockedYm } from '@/lib/ym';
import { EmptyFrame } from '@/ui/empty-frame';
import { ReviewClear } from '@/ui/illustrations/review-clear';
import { ReviewNone } from '@/ui/illustrations/review-none';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { NoLockedPeriod } from '@/features/summary/period-lock-gate';
import { usePeriodSummary } from '@/features/summary/summary.api';
import type { ReviewFilter } from './review.api';

// Tab Chờ xem rỗng: chữ theo trạng thái kỳ; chưa kỳ nào khóa thì dùng khung trống chung của trang chỉ-kỳ-khóa
export function ReviewEmpty({ status, onSeeAccepted }: { status: ReviewFilter; onSeeAccepted: () => void }) {
  const { t, i18n } = useTranslation();
  const open = useCurrentPeriod().data;
  const pending = status === 'pending';
  const locked = usePeriodSummary(open && pending ? lockedYm(open.ym) : undefined).data;
  if (pending && locked?.deadline === null) return <NoLockedPeriod />;
  const hint = pending && open ? t('review.empty.openHint', { month: monthOf(open.ym), lockPhrase: lockPhrase(open.deadline, langOf(i18n.language)) }) : undefined;
  return (
    <EmptyFrame
      art={pending ? <ReviewClear /> : <ReviewNone />}
      title={t(`review.empty.${status}`)}
      hint={hint}
      action={
        pending && (
          <button type="button" className="btn" onClick={onSeeAccepted}>
            {t('review.empty.pendingAction')}
          </button>
        )
      }
    />
  );
}
