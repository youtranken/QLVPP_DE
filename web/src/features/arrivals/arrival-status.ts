import type { ArrivalRow } from './arrival-rows';

export type ArrivalState = 'done' | 'short' | 'over' | 'none' | 'adm_out';
export interface ArrivalStatus {
  state: ArrivalState;
  n: number;
}

const FINISHED = new Set<ArrivalState>(['done', 'over', 'adm_out']);

function compare(ordered: number, got: number): ArrivalStatus {
  if (got < ordered) return { state: 'short', n: ordered - got };
  if (got > ordered) return { state: 'over', n: got - ordered };
  return { state: 'done', n: 0 };
}

// Trạng thái đã lưu: theo số đã về so với đề nghị mua
export function savedState(r: ArrivalRow): ArrivalStatus {
  if (r.adm_out) return { state: 'adm_out', n: 0 };
  if (r.ordered === 0 && r.received === 0) return { state: 'none', n: 0 };
  return compare(r.ordered, r.received);
}

// Trạng thái sau khi bấm Lưu: null khi chưa nhập gì hoặc không đổi so với đã lưu (không vẽ chip "Sau lưu")
export function afterState(r: ArrivalRow, qty: number): ArrivalStatus | null {
  if (qty === 0 || r.adm_out) return null;
  const next = compare(r.ordered, r.received + qty);
  const saved = savedState(r);
  return next.state === saved.state && next.n === saved.n ? null : next;
}

export function groupCounts(rows: ArrivalRow[], qtyOf: (r: ArrivalRow) => number): { done: number; total: number; doneAfter: number } {
  const counted = rows.filter((r) => !r.added);
  const isDone = (s: ArrivalStatus) => FINISHED.has(s.state);
  return {
    total: counted.length,
    done: counted.filter((r) => isDone(savedState(r))).length,
    doneAfter: counted.filter((r) => isDone(afterState(r, qtyOf(r)) ?? savedState(r))).length,
  };
}

// Cột "Còn thiếu" chỉ khi có dòng nhập thấp hơn phần còn lại; ADM hết hàng không tính thiếu
export const showShortColumn = (rows: ArrivalRow[], qtyOf: (r: ArrivalRow) => number): boolean => rows.some((r) => !r.adm_out && r.received + qtyOf(r) < r.ordered);

export const shortOf = (r: ArrivalRow, qty: number): number => (r.adm_out ? 0 : Math.max(0, r.ordered - r.received - qty));
