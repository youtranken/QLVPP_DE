import { useState } from 'react';
import { parseQty, prefillOf, type ArrivalRow } from './arrival-rows';

// Số đang gõ của từng hàng (trình duyệt); thiếu thì lấy số điền sẵn (phần còn thiếu)
export function useArrivalsDraft() {
  const [raw, setRaw] = useState<Record<string, string>>({});

  const textOf = (r: ArrivalRow) => (r.adm_out ? '0' : (raw[r.item_id] ?? String(prefillOf(r))));
  const qtyOf = (r: ArrivalRow) => (r.adm_out ? 0 : parseQty(textOf(r)).qty);
  const errorOf = (r: ArrivalRow) => (r.adm_out ? null : parseQty(textOf(r)).error);

  const change = (id: string, value: string) => setRaw((prev) => ({ ...prev, [id]: value }));
  // Xóa trống rồi rời ô: ghi lại "0" thay vì báo lỗi
  const blur = (id: string) => setRaw((prev) => (prev[id] !== undefined && prev[id].trim() === '' ? { ...prev, [id]: '0' } : prev));
  const clearMany = (ids: string[]) =>
    setRaw((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  const clear = (id: string) => clearMany([id]);

  return { textOf, qtyOf, errorOf, change, blur, clear, clearMany };
}

export type ArrivalsDraft = ReturnType<typeof useArrivalsDraft>;
