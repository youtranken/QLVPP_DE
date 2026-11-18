import { isReceivedFull, type ArrivalRow } from './arrival-rows';

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

export type StatusCell = { kind: 'tag'; status: ArrivalStatus } | { kind: 'owe'; qty: number; n: number };

// Cột Tình trạng theo số đang gõ: gõ thiếu thì báo phần NCC còn nợ, gõ dư thì báo dư ngay;
// gõ vừa đủ thì giữ chip đã lưu — trạng thái chỉ đổi khi bấm Nhận
export function statusCell(r: ArrivalRow, qty: number): StatusCell {
  const saved = savedState(r);
  if (r.adm_out || qty === 0) return { kind: 'tag', status: saved };
  const short = Math.max(0, r.ordered - r.received);
  if (qty < short) return { kind: 'owe', qty, n: short - qty };
  if (r.received + qty > r.ordered) return { kind: 'tag', status: { state: 'over', n: r.received + qty - r.ordered } };
  return { kind: 'tag', status: saved };
}

// Nhóm không nhận đủ được: có món NCC hết hàng hoặc ô gõ ít hơn phần còn thiếu → nút ghi "Nhận hàng"
export const partialReceive = (rows: ArrivalRow[], qtyOf: (r: ArrivalRow) => number): boolean =>
  rows.some((r) => r.adm_out || (!isReceivedFull(r) && qtyOf(r) < r.ordered - r.received));

export function groupCounts(rows: ArrivalRow[]): { done: number; total: number } {
  return { total: rows.length, done: rows.filter((r) => FINISHED.has(savedState(r).state)).length };
}
