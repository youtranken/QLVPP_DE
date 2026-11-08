import { describe, expect, it } from 'vitest';
import type { ArrivalRow } from './arrival-rows';
import { afterState, groupCounts, savedState, shortOf, showShortColumn } from './arrival-status';

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
  added: false,
  ...over,
});

describe('trạng thái đã lưu và sau lưu', () => {
  it('Bìa nhựa: đề nghị 19, đã về 9, nhập 10 → saved short 10, after done', () => {
    const r = row({ ordered: 19, received: 9 });
    expect(savedState(r)).toEqual({ state: 'short', n: 10 });
    expect(afterState(r, 10)).toEqual({ state: 'done', n: 0 });
  });

  it('Kẹp bướm: đề nghị 8, nhập 10 → after over 2', () => {
    const r = row({ ordered: 8, received: 0 });
    expect(afterState(r, 10)).toEqual({ state: 'over', n: 2 });
  });

  it('Bìa trình ký: đề nghị 3, đã về 1, nhập 1 → after short 1', () => {
    const r = row({ ordered: 3, received: 1 });
    expect(afterState(r, 1)).toEqual({ state: 'short', n: 1 });
  });

  it('biên: received+qty = ordered → done; = ordered−1 → short 1; = ordered+1 → over 1', () => {
    const r = row({ ordered: 5, received: 2 });
    expect(afterState(r, 3)?.state).toBe('done');
    expect(afterState(r, 2)).toEqual({ state: 'short', n: 1 });
    expect(afterState(r, 4)).toEqual({ state: 'over', n: 1 });
  });

  it('qty 0 → afterState null; trùng đã lưu → null', () => {
    expect(afterState(row({ ordered: 5, received: 2 }), 0)).toBeNull();
    expect(afterState(row({ ordered: 5, received: 5 }), 0)).toBeNull();
    expect(afterState(row({ ordered: 5, received: 0 }), 5)).not.toBeNull();
  });

  it('ADM hết hàng thắng; chưa đề nghị chưa về là none', () => {
    expect(savedState(row({ adm_out: true }))).toEqual({ state: 'adm_out', n: 0 });
    expect(afterState(row({ adm_out: true }), 3)).toBeNull();
    expect(savedState(row({ ordered: 0, received: 0, added: true }))).toEqual({ state: 'none', n: 0 });
    expect(savedState(row({ ordered: 4, received: 0 }))).toEqual({ state: 'short', n: 4 });
  });
});

describe('groupCounts', () => {
  const kep = [
    row({ item_id: '1', ordered: 3, received: 3 }),
    row({ item_id: '2', ordered: 2, received: 2 }),
    row({ item_id: '3', ordered: 5, received: 0 }),
    row({ item_id: '4', ordered: 5, received: 0 }),
    row({ item_id: '5', ordered: 5, received: 0 }),
    row({ item_id: 'x', ordered: 0, received: 0, added: true }),
  ];

  it('Kẹp & dán → {done:2,total:5,doneAfter:4} (không tính hàng thêm tay)', () => {
    const qty: Record<string, number> = { '3': 5, '4': 5, '5': 2, x: 9 };
    expect(groupCounts(kep, (r) => qty[r.item_id] ?? 0)).toEqual({ done: 2, total: 5, doneAfter: 4 });
  });

  it('Lưu trữ → {done:0,total:2,doneAfter:1}', () => {
    const rows = [row({ item_id: 'a', ordered: 4 }), row({ item_id: 'b', ordered: 4 })];
    expect(groupCounts(rows, (r) => (r.item_id === 'a' ? 4 : 0))).toEqual({ done: 0, total: 2, doneAfter: 1 });
  });

  it('ADM hết hàng tính là xong', () => {
    expect(groupCounts([row({ adm_out: true })], () => 0)).toEqual({ done: 1, total: 1, doneAfter: 1 });
  });
});

describe('cột Còn thiếu', () => {
  it('false khi mọi hàng nhập đủ; true khi một hàng nhập thiếu 1', () => {
    const rows = [row({ item_id: 'a', ordered: 5 }), row({ item_id: 'b', ordered: 5, received: 2 })];
    const full = (r: ArrivalRow) => r.remaining;
    expect(showShortColumn(rows, full)).toBe(false);
    expect(showShortColumn(rows, (r) => (r.item_id === 'b' ? 2 : 5))).toBe(true);
  });

  it('ADM hết hàng không tính thiếu; shortOf = phần còn thiếu sau nhập', () => {
    expect(showShortColumn([row({ adm_out: true })], () => 0)).toBe(false);
    expect(shortOf(row({ ordered: 10, received: 4 }), 2)).toBe(4);
    expect(shortOf(row({ ordered: 10, received: 4 }), 9)).toBe(0);
    expect(shortOf(row({ adm_out: true }), 0)).toBe(0);
  });
});
