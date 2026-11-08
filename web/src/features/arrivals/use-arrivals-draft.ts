import { useState } from 'react';
import { parseQty, prefillOf, type ArrivalRow } from './arrival-rows';

// Số đang gõ của từng hàng (trình duyệt); thiếu thì lấy số điền sẵn. "Điền đủ cả nhóm" chỉ điền, không có bước hoàn tác
export function useArrivalsDraft() {
  const [raw, setRaw] = useState<Record<string, string>>({});

  const textOf = (r: ArrivalRow) => (r.adm_out ? '0' : (raw[r.item_id] ?? String(prefillOf(r))));
  const qtyOf = (r: ArrivalRow) => (r.adm_out ? 0 : parseQty(textOf(r)).qty);
  const errorOf = (r: ArrivalRow) => (r.adm_out ? null : parseQty(textOf(r)).error);

  const change = (id: string, value: string) => setRaw((prev) => ({ ...prev, [id]: value }));
  const clear = (id: string) =>
    setRaw((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  const reset = () => setRaw({});

  const fill = (rows: ArrivalRow[]) => {
    const targets = rows.filter((r) => !r.adm_out);
    setRaw((prev) => ({ ...prev, ...Object.fromEntries(targets.map((r) => [r.item_id, String(r.remaining)])) }));
  };

  return { textOf, qtyOf, errorOf, change, clear, reset, fill };
}

export type ArrivalsDraft = ReturnType<typeof useArrivalsDraft>;
