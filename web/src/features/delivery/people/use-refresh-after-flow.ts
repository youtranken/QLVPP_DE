import { useQueryClient } from '@tanstack/react-query';
import { BACKLOG_KEY } from '../delivery.api';
import { SUMMARY_KEY } from '@/features/summary/summary.api';
import { useRefreshStock } from '@/features/stock/stock.api';
import { DELIVERY_PEOPLE_KEY } from './delivery-people.api';

// Hàng về và một đợt giao đổi cùng một tập: Cần mua của báo cáo (qua useRefreshStock), danh sách người, Tổng hợp/đếm sidebar,
// Còn nợ và tồn kho. Phần riêng của từng luồng (vd phiếu mở ở trang cũ) truyền qua extraKeys.
export function useRefreshAfterFlow(extraKeys: readonly (readonly unknown[])[] = []) {
  const qc = useQueryClient();
  const refreshStock = useRefreshStock();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: DELIVERY_PEOPLE_KEY }),
      qc.invalidateQueries({ queryKey: SUMMARY_KEY }),
      qc.invalidateQueries({ queryKey: BACKLOG_KEY }),
      ...extraKeys.map((queryKey) => qc.invalidateQueries({ queryKey })),
      refreshStock(),
    ]);
}
