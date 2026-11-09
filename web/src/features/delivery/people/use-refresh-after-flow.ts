import { useQueryClient } from '@tanstack/react-query';
import { BACKLOG_KEY } from '../delivery.api';
import { ARRIVALS_PLAN_KEY } from '@/features/arrivals/arrivals.api';
import { SEND_STATE_KEY } from '@/features/send-adm/send-adm.api';
import { SUMMARY_KEY } from '@/features/summary/summary.api';
import { useRefreshStock } from '@/features/stock/stock.api';
import { DELIVERY_PEOPLE_KEY } from './delivery-people.api';

// Mọi thao tác đổi dòng phiếu hay tồn (giảm phiếu, giao, Hủy nợ, duyệt, ADM hết hàng, Hàng về) làm mới cùng một tập:
// Tổng hợp/đếm sidebar, danh sách người giao, Còn nợ, trạng thái Gửi ADM (W6), kế hoạch Hàng về (W14), tồn + báo cáo.
// Phần riêng của từng luồng (vd phiếu đang mở) truyền qua extraKeys.
export function useRefreshAfterLineChange(extraKeys: readonly (readonly unknown[])[] = []) {
  const qc = useQueryClient();
  const refreshStock = useRefreshStock();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: SUMMARY_KEY }),
      qc.invalidateQueries({ queryKey: DELIVERY_PEOPLE_KEY }),
      qc.invalidateQueries({ queryKey: BACKLOG_KEY }),
      qc.invalidateQueries({ queryKey: SEND_STATE_KEY }),
      qc.invalidateQueries({ queryKey: ARRIVALS_PLAN_KEY }),
      ...extraKeys.map((queryKey) => qc.invalidateQueries({ queryKey })),
      refreshStock(),
    ]);
}
