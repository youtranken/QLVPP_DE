import { Navigate, useSearchParams } from 'react-router-dom';
import { YM } from '@/lib/ym';
import { Loading } from '@/ui/load-state';
import { useReviewLines } from '@/features/review/review.api';

// Trang Món ngoài danh mục đã bỏ — link cũ (chuông, dấu trang, link ?ym= đã lưu trong chuông) về Kỳ tháng lọc "Có món chờ duyệt":
// có ?ym hợp lệ thì đúng kỳ đó, không thì kỳ cũ nhất còn món chờ
export function ReviewRedirect() {
  const [params] = useSearchParams();
  const asked = params.get('ym');
  const pending = useReviewLines('pending', '');
  if (asked && YM.test(asked)) return <Navigate replace to={`/admin/month?ym=${asked}&chip=pending`} />;
  if (pending.isPending) return <Loading />;
  const yms = (pending.data?.items ?? []).map((r) => r.period_ym.slice(0, 7)).sort();
  return <Navigate replace to={yms.length ? `/admin/month?ym=${yms[0]}&chip=pending` : '/admin/month?chip=pending'} />;
}
