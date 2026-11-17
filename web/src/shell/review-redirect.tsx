import { Navigate } from 'react-router-dom';
import { Loading } from '@/ui/load-state';
import { useReviewLines } from '@/features/review/review.api';

// Trang Món ngoài danh mục đã bỏ — link cũ (chuông, dấu trang) về Kỳ tháng, kỳ cũ nhất còn món chờ, lọc "Có món chờ duyệt"
export function ReviewRedirect() {
  const pending = useReviewLines('pending', '');
  if (pending.isPending) return <Loading />;
  const yms = (pending.data?.items ?? []).map((r) => r.period_ym.slice(0, 7)).sort();
  return <Navigate replace to={yms.length ? `/admin/month?ym=${yms[0]}&chip=pending` : '/admin/month?chip=pending'} />;
}
