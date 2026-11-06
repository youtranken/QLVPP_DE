import { useState } from 'react';
import { parseQty, prefillOf, type ArrivalRow } from './arrival-rows';

type Saved = Record<string, string | undefined>;

// Số đang gõ của từng hàng (trình duyệt); thiếu thì lấy số điền sẵn. "Về đủ cả nhóm" nhớ số trước đó để bỏ điền
export function useArrivalsDraft() {
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [fills, setFills] = useState<Record<string, Saved>>({});

  const textOf = (r: ArrivalRow) => (r.adm_out ? '0' : (raw[r.item_id] ?? String(prefillOf(r))));
  const qtyOf = (r: ArrivalRow) => (r.adm_out ? 0 : parseQty(textOf(r)).qty);
  const errorOf = (r: ArrivalRow) => (r.adm_out ? null : parseQty(textOf(r)).error);
  const typed = (rows: ArrivalRow[]) => rows.some((r) => !r.adm_out && raw[r.item_id] !== undefined && raw[r.item_id] !== String(prefillOf(r)));

  const change = (id: string, value: string) => setRaw((prev) => ({ ...prev, [id]: value }));
  const clear = (id: string) =>
    setRaw((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  const reset = () => {
    setRaw({});
    setFills({});
  };

  const fill = (group: string, rows: ArrivalRow[]) => {
    const targets = rows.filter((r) => !r.adm_out && r.usable);
    setFills((prev) => ({ ...prev, [group]: Object.fromEntries(targets.map((r) => [r.item_id, raw[r.item_id]])) }));
    setRaw((prev) => ({ ...prev, ...Object.fromEntries(targets.map((r) => [r.item_id, String(r.remaining)])) }));
  };
  const unfill = (group: string) => {
    const saved = fills[group];
    if (!saved) return;
    setRaw((prev) => {
      const next = { ...prev };
      for (const [id, v] of Object.entries(saved)) {
        if (v === undefined) delete next[id];
        else next[id] = v;
      }
      return next;
    });
    setFills((prev) => {
      const next = { ...prev };
      delete next[group];
      return next;
    });
  };

  return { textOf, qtyOf, errorOf, typed, change, clear, reset, fill, unfill, filled: (group: string) => fills[group] !== undefined };
}

export type ArrivalsDraft = ReturnType<typeof useArrivalsDraft>;
