import { Navigate, useParams } from 'react-router-dom';
import { NotFound } from '@/ui/load-state';
import { MemberPage } from '@/shell/member-page';
import { YM } from '@/lib/ym';
import { useCurrentPeriod } from './request.api';
import { HistoryLayout } from './history-page';

export function HistoryDetailPage() {
  const { ym = '' } = useParams();
  const period = useCurrentPeriod();
  if (!YM.test(ym)) return <MemberPage><NotFound /></MemberPage>;
  // Kỳ đang mở sửa được ở trang Đăng ký, không có bản chỉ đọc
  if (period.data?.is_open && period.data.ym === ym) return <Navigate to="/" replace />;
  return <HistoryLayout ym={ym} />;
}
