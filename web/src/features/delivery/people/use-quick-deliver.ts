import { useMemo } from 'react';
import type { DeliveryPerson } from './delivery-people.api';
import { dialogRows, priorityOf } from './deliver-plan';

// Nút chính của thẻ chỉ mở hộp giao; ở đây chỉ tính đề xuất (theo người đăng ký trước) để biết nút bật hay không.
// Bật khi còn dòng giao được từ tủ/hàng đã về, hoặc còn dòng ADM hết hàng để hủy phần thiếu.
export function useQuickDeliver(people: DeliveryPerson[]) {
  return useMemo(() => {
    const priority = priorityOf(people);
    const canDeliver = (p: DeliveryPerson) => p.status !== 'done' && dialogRows(p, priority).some((r) => r.kind !== 'skip');
    return { canDeliver };
  }, [people]);
}
