import { describe, expect, it } from 'vitest';
import type { ArrivalRow } from './arrival-rows';
import { groupCounts, partialReceive, savedState, statusCell } from './arrival-status';

const row = (over: Partial<ArrivalRow> = {}): ArrivalRow => ({
  item_id: 'a',
  code: null,
  name: 'A',
  name_en: null,
  unit: 'cay',
  category_id: null,
  image_file_id: null,
  ordered: 10,
  received: 0,
  remaining: 10,
  stock: 0,
  usable: true,
  inactive_reason: null,
  adm_out: false,
  adm_out_final: false,
  reduced: 0,
  ...over,
});

describe('trạng thái đã lưu', () => {
  it('đề nghị 19, đã về 9 → short 10; đủ → done; dư → over; NCC hết hàng thắng; chưa đề nghị chưa về là none', () => {
    expect(savedState(row({ ordered: 19, received: 9 }))).toEqual({ state: 'short', n: 10 });
    expect(savedState(row({ ordered: 5, received: 5 }))).toEqual({ state: 'done', n: 0 });
    expect(savedState(row({ ordered: 8, received: 10 }))).toEqual({ state: 'over', n: 2 });
    expect(savedState(row({ adm_out: true }))).toEqual({ state: 'adm_out', n: 0 });
    expect(savedState(row({ ordered: 0, received: 0 }))).toEqual({ state: 'none', n: 0 });
  });
});

describe('statusCell — cột Tình trạng theo số đang gõ', () => {
  it('gõ ít hơn phần còn thiếu → chữ "Nhập: qty" / "NCC còn nợ: n" (đề nghị 5, gõ 3 → nợ 2)', () => {
    expect(statusCell(row({ ordered: 5, received: 0 }), 3)).toEqual({ kind: 'owe', qty: 3, n: 2 });
    expect(statusCell(row({ ordered: 20, received: 10 }), 9)).toEqual({ kind: 'owe', qty: 9, n: 1 });
  });

  it('chưa gõ (0) → chip đã lưu "Thiếu n"', () => {
    expect(statusCell(row({ ordered: 5, received: 0 }), 0)).toEqual({ kind: 'tag', status: { state: 'short', n: 5 } });
  });

  it('gõ đúng phần còn thiếu → vẫn chip đã lưu, đổi khi bấm Nhận', () => {
    expect(statusCell(row({ ordered: 20, received: 10 }), 10)).toEqual({ kind: 'tag', status: { state: 'short', n: 10 } });
  });

  it('gõ dư (đề nghị 8, gõ 10) → chip "Dư 2", không còn "Thiếu 8"', () => {
    expect(statusCell(row({ ordered: 8, received: 0 }), 10)).toEqual({ kind: 'tag', status: { state: 'over', n: 2 } });
    expect(statusCell(row({ ordered: 5, received: 2 }), 4)).toEqual({ kind: 'tag', status: { state: 'over', n: 1 } });
  });

  it('NCC hết hàng → chip NCC hết hàng dù có số', () => {
    expect(statusCell(row({ adm_out: true }), 3)).toEqual({ kind: 'tag', status: { state: 'adm_out', n: 0 } });
  });
});

describe('partialReceive — nút "Nhận hàng" thay "Nhận đủ hàng"', () => {
  it('mọi dòng gõ đủ phần còn thiếu → false', () => {
    const rows = [row({ item_id: 'a', ordered: 5 }), row({ item_id: 'b', ordered: 3, received: 3 })];
    expect(partialReceive(rows, (r) => r.remaining)).toBe(false);
  });

  it('một dòng gõ ít hơn phần còn thiếu (kể cả 0) → true', () => {
    const rows = [row({ item_id: 'a', ordered: 5 }), row({ item_id: 'b', ordered: 4, remaining: 4 })];
    expect(partialReceive(rows, (r) => (r.item_id === 'b' ? 3 : 5))).toBe(true);
    expect(partialReceive(rows, (r) => (r.item_id === 'b' ? 0 : 5))).toBe(true);
  });

  it('có món NCC hết hàng → true; dòng đã nhận đủ không tính', () => {
    expect(partialReceive([row({ adm_out: true })], () => 0)).toBe(true);
    expect(partialReceive([row({ ordered: 5, received: 5 })], () => 0)).toBe(false);
  });
});

describe('groupCounts', () => {
  const kep = [
    row({ item_id: '1', ordered: 3, received: 3 }),
    row({ item_id: '2', ordered: 2, received: 2 }),
    row({ item_id: '3', ordered: 5, received: 0 }),
  ];

  it('Kẹp & dán → {done:2,total:3} theo số đã lưu (không đếm "sau lưu")', () => {
    expect(groupCounts(kep)).toEqual({ done: 2, total: 3 });
  });

  it('NCC hết hàng tính là xong', () => {
    expect(groupCounts([row({ adm_out: true })])).toEqual({ done: 1, total: 1 });
  });
});
