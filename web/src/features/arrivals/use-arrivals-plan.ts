import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useRefreshAfterLineChange } from '@/features/delivery/people/use-refresh-after-flow';
import { arrivalsPlanQuery, setAdmOut } from './arrivals.api';

export const useArrivalsPlan = (ym: string) => useQuery(arrivalsPlanQuery(ym));
// Chỉ đọc bản đã có trong bộ nhớ đệm, không tự gọi API
export const useArrivalsPlanCached = (ym: string) => useQuery({ ...arrivalsPlanQuery(ym), enabled: false });

// Nhập hàng đổi kế hoạch, tủ, danh sách giao và Còn nợ cùng lúc — tập chung đã gồm mọi kế hoạch Hàng về
export function useRefreshArrivals() {
  const refreshAll = useRefreshAfterLineChange();
  return () => refreshAll().then(() => undefined);
}

// Đánh/bỏ "ADM hết hàng" ghi ngay; trả mã lỗi (nếu có) để trang báo, luôn tải lại kế hoạch
export function useAdmOutToggle(ym: string) {
  const { csrfToken } = useMe();
  const refresh = useRefreshArrivals();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const toggle = async (key: string, on: boolean): Promise<string | null> => {
    if (busy.has(key)) return null;
    setBusy((s) => new Set(s).add(key));
    let code: string | null = null;
    try {
      await setAdmOut(ym, key, on, csrfToken);
    } catch (e) {
      code = apiErrorCode(e) ?? 'UNKNOWN';
    }
    await refresh();
    setBusy((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    return code;
  };
  return { busy, toggle };
}
