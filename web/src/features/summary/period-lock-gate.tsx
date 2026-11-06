import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { apiErrorCode, apiErrorString } from '@/lib/api-error';
import { langOf, lockPhrase } from '@/lib/period-text';
import { lockedYm } from '@/lib/ym';
import { EmptyFrame } from '@/ui/empty-frame';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { OpenPeriodNotice } from './open-period-notice';
import { useUnlockedSentence } from './use-unlocked-sentence';
import { usePeriodSummary } from './summary.api';

interface Props {
  ym: string;
  // Bọc câu chờ/lỗi/chưa khóa trong khung trang của màn gọi (tiêu đề, lề)
  frame?: (node: ReactNode) => ReactNode;
  children: ReactNode;
}

export function NoLockedPeriod() {
  const { t, i18n } = useTranslation();
  const open = useCurrentPeriod().data;
  const progress = usePeriodSummary(open?.ym).data;
  if (!open) return <Loading />;
  const hint = progress
    ? t('summary.gate.noneHint', { month: monthOf(open.ym), registered: progress.registered, headcount: progress.headcount, lockPhrase: lockPhrase(open.deadline, langOf(i18n.language)) })
    : undefined;
  return (
    <EmptyFrame
      title={t('summary.gate.noneTitle')}
      hint={hint}
      action={
        <Link className="btn" to="/admin/home">
          {t('summary.gate.viewProgress')}
        </Link>
      }
    />
  );
}

// Chặn màn thao tác trên số liệu kỳ khóa: chưa tới hạn thì số liệu còn đổi theo đăng ký
export function PeriodLockGate({ ym, frame = (n) => n, children }: Props) {
  const summary = usePeriodSummary(ym);
  const current = useCurrentPeriod().data;
  const unlocked = useUnlockedSentence(ym);

  if (summary.isError) {
    if (apiErrorCode(summary.error) !== 'PERIOD_NOT_LOCKED') return <>{frame(<LoadError onRetry={() => void summary.refetch()} />)}</>;
    return <>{frame(<EmptyState title={unlocked(apiErrorString(summary.error, 'deadline') ?? current?.deadline)} />)}</>;
  }
  if (!summary.data) return <>{frame(<Loading />)}</>;
  const { deadline } = summary.data;
  // Không có dòng periods: kỳ khóa mới nhất (cài mới) = chưa có kỳ nào khóa; tháng cũ hơn thì server vẫn coi là đã khóa
  if (deadline === null) {
    if (!current) return <>{frame(<Loading />)}</>;
    if (ym >= lockedYm(current.ym)) return <>{frame(<NoLockedPeriod />)}</>;
  } else if (new Date(deadline).getTime() > Date.now()) return <>{frame(<EmptyState title={unlocked(deadline)} />)}</>;
  return (
    <div className="ct-page">
      <OpenPeriodNotice />
      {children}
    </div>
  );
}
