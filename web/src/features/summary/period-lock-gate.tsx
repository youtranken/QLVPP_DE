import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { vnLockDate } from '@/lib/format-time';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { monthOf } from '@/features/request/request-format';
import { usePeriodSummary } from './summary.api';

interface Props {
  ym: string;
  // Khóa i18n của câu "kỳ chưa khóa" (nhận {{month}}, {{deadline}})
  unlockedKey: string;
  // Bọc câu chờ/lỗi/chưa khóa trong khung trang của màn gọi (tiêu đề, lề)
  frame?: (node: ReactNode) => ReactNode;
  children: ReactNode;
}

// Chặn màn thao tác trên số liệu kỳ khóa (Hàng về, Gửi ADM): chưa tới hạn thì Cần mua còn đổi theo đăng ký
export function PeriodLockGate({ ym, unlockedKey, frame = (n) => n, children }: Props) {
  const { t } = useTranslation();
  const summary = usePeriodSummary(ym);
  if (summary.isError) return <>{frame(<LoadError onRetry={() => void summary.refetch()} />)}</>;
  if (!summary.data) return <>{frame(<Loading />)}</>;
  const deadline = summary.data.deadline;
  if (deadline && new Date(deadline).getTime() > Date.now()) {
    return <>{frame(<EmptyState title={t(unlockedKey, { month: monthOf(ym), deadline: vnLockDate(deadline) })} />)}</>;
  }
  return <>{children}</>;
}
