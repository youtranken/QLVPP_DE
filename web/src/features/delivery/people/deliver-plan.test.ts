import { describe, expect, it } from 'vitest';
import { allocateWithPriority, dialogRows, limitsOf, priorityOf, stepsOf, stockShortages, totalsOf, type PlanLine } from './deliver-plan';
import { person, pLine } from './people-fixtures';

const plan = (over: Partial<PlanLine>): PlanLine => ({
  line_id: 'x',
  user_sub: 'u',
  key: 'i-pen',
  period_ym: '2026-10',
  request_at: '2026-10-01T01:00:00.000000Z',
  line_at: '2026-10-01T01:00:00.000000Z',
  remaining: 1,
  active: true,
  ...over,
});
const stock = (n: number) => new Map([['i-pen', n]]);

describe('allocateWithPriority — gợi ý theo người đăng ký trước', () => {
  const a = plan({ line_id: 'a', user_sub: 'A', remaining: 5, request_at: '2026-10-01T08:00:00.000000Z' });
  const b = plan({ line_id: 'b', user_sub: 'B', remaining: 3, request_at: '2026-10-01T09:00:00.000000Z' });

  it('tủ 6: A (08:00) 5 → đề xuất 5; B (09:00) 3 → đề xuất 1, giữ 5 cho 1 người, trần 3', () => {
    const r = allocateWithPriority([b, a], stock(6));
    expect(r.get('a')).toEqual({ suggest: 5, cap: 5, ahead_qty: 0, ahead_people: 0 });
    expect(r.get('b')).toEqual({ suggest: 1, cap: 3, ahead_qty: 5, ahead_people: 1 });
  });

  it('tủ 8 → B đề xuất 3; tủ 5 → B 0 (biên: tủ = phần giữ)', () => {
    expect(allocateWithPriority([a, b], stock(8)).get('b')?.suggest).toBe(3);
    expect(allocateWithPriority([a, b], stock(5)).get('b')?.suggest).toBe(0);
    expect(allocateWithPriority([a, b], stock(4)).get('b')).toMatchObject({ suggest: 0, cap: 3 });
  });

  it('thứ tự: kỳ cũ trước mọi phiếu kỳ này; cùng request_at → line_at; cùng cả hai → id', () => {
    const old = plan({ line_id: 'z', user_sub: 'Z', period_ym: '2026-09', remaining: 2, request_at: '2026-12-01T00:00:00.000000Z' });
    const l1 = plan({ line_id: 'l1', user_sub: 'L1', remaining: 2, line_at: '2026-10-01T02:00:00.000000Z' });
    const l2 = plan({ line_id: 'l2', user_sub: 'L2', remaining: 2, line_at: '2026-10-01T01:30:00.000000Z' });
    const i1 = plan({ line_id: 'i1', user_sub: 'I1', remaining: 2, line_at: '2026-10-01T03:00:00.000000Z' });
    const i2 = plan({ line_id: 'i2', user_sub: 'I2', remaining: 2, line_at: '2026-10-01T03:00:00.000000Z' });
    const r = allocateWithPriority([i2, l1, i1, l2, old], stock(100));
    expect(['z', 'l2', 'l1', 'i1', 'i2'].map((id) => r.get(id)?.ahead_qty)).toEqual([0, 2, 4, 6, 8]);
  });

  it('người đã nghỉ: đề xuất 0 và không giữ tủ của người sau', () => {
    const left = plan({ line_id: 'left', user_sub: 'L', remaining: 4, active: false, request_at: '2026-10-01T07:00:00.000000Z' });
    const r = allocateWithPriority([left, b], stock(3));
    expect(r.get('left')).toMatchObject({ suggest: 0, cap: 3 });
    expect(r.get('b')).toMatchObject({ suggest: 3, ahead_qty: 0, ahead_people: 0 });
  });

  it('dòng ngoài tủ (không có trong map tồn) không có kết quả', () => {
    expect(allocateWithPriority([plan({ line_id: 'c', key: 'custom:x' })], stock(5)).has('c')).toBe(false);
  });
});

describe('dialogRows + limitsOf — trần trong hộp', () => {
  const rowsFor = (lines: ReturnType<typeof pLine>[], extra: ReturnType<typeof person>[] = []) => {
    const p = person({ lines });
    return dialogRows(p, priorityOf([p, ...extra]));
  };

  it.each([
    ['còn 4 tủ 9', 4, 9, 4],
    ['tủ 3 còn 9', 9, 3, 3],
  ])('%s → trần %i', (_n, remaining, stockQty, cap) => {
    const rows = rowsFor([pLine({ remaining_qty: remaining, qty: remaining, stock_qty: stockQty })]);
    expect(limitsOf(rows, {})['l-1']).toMatchObject({ cap, value: cap });
    expect(limitsOf(rows, { 'l-1': cap + 1 })['l-1'].value).toBe(cap);
  });

  it.each([
    [5, [3, 2]],
    [6, [3, 3]],
    [7, [3, 3]],
  ])('hai dòng cùng món 3 + 3 (nợ trước), tồn %i → %j', (s, want) => {
    const rows = rowsFor([
      pLine({ line_id: 'c', qty: 3, remaining_qty: 3, stock_qty: s }),
      pLine({ line_id: 'd', period_ym: '2026-09', is_debt: true, qty: 3, remaining_qty: 3, stock_qty: s }),
    ]);
    expect(rows.map((r) => r.line.line_id)).toEqual(['d', 'c']);
    const lim = limitsOf(rows, {});
    expect([lim.d.value, lim.c.value]).toEqual(want);
    // Hạ dòng trước thì dòng sau được thêm (tới phần còn của nó)
    if (s === 5) expect(limitsOf(rows, { d: 1 }).c.cap).toBe(3);
  });

  it('dòng chờ xem → nhóm không giao (review); tủ 0 → không giao (stock); dòng NCC hết hàng → nhóm adm', () => {
    const rows = rowsFor([
      pLine({ line_id: 'r', item_id: null, stock_qty: null, review_status: 'pending' }),
      pLine({ line_id: 's', item_id: 'i-a4', stock_qty: 0 }),
      pLine({ line_id: 'm', item_id: 'i-clip', stock_qty: 0, adm_out: true }),
    ]);
    expect(Object.fromEntries(rows.map((r) => [r.line.line_id, [r.kind, r.reason ?? null]]))).toEqual({
      r: ['skip', 'review'],
      s: ['skip', 'stock'],
      m: ['adm', null],
    });
  });

  it('người đã nghỉ: đề xuất 0 mọi dòng nhưng trần vẫn theo tủ', () => {
    const p = person({ user_status: 'inactive', lines: [pLine({ remaining_qty: 3, stock_qty: 9 })] });
    const rows = dialogRows(p, priorityOf([p]));
    expect(limitsOf(rows, {})['l-1']).toMatchObject({ value: 0, cap: 3 });
  });

  it('món ngoài DM theo deliver_cap', () => {
    const rows = rowsFor([pLine({ line_id: 'k', item_id: null, stock_qty: null, remaining_qty: 4, deliver_cap: 1 })]);
    expect(limitsOf(rows, {}).k).toMatchObject({ cap: 1, value: 1 });
  });

  it('món ngoài DM đã duyệt chưa nhận hàng (deliver_cap 0) → vẫn ở bảng giao (give, notReceived), trần 0, phần còn lại tính chưa nhận', () => {
    const rows = rowsFor([pLine({ line_id: 'k', item_id: null, stock_qty: null, review_status: 'accepted', remaining_qty: 2, deliver_cap: 0 })]);
    expect(rows[0]).toMatchObject({ kind: 'give', reason: 'notReceived', suggest: 0 });
    const lim = limitsOf(rows, { k: 2 });
    expect(lim.k).toMatchObject({ cap: 0, value: 0 });
    expect(totalsOf(rows, lim)).toEqual({ give: 0, left: 2, debt: 0, cancel: 0 });
    expect(stepsOf(rows, lim)).toEqual([]);
  });
});

describe('dialogRows — thứ tự món trong hộp giao', () => {
  const pen = { name: 'Bút', sort_order: 10 };
  const paper = { name: 'giấy', sort_order: 10 };
  it('nợ trước (kỳ cũ trước), rồi trong mỗi kỳ theo thứ tự món chung (nhóm → số thứ tự → tên), ngoài DM cuối; không theo thứ tự đăng ký', () => {
    const at = (n: number) => `2026-10-01T01:00:0${n}.000000Z`;
    const p = person({
      lines: [
        pLine({ line_id: 'custom', item_id: null, stock_qty: null, name: 'Áo mưa', deliver_cap: 1, sort_order: null, line_at: at(0) }),
        pLine({ line_id: 'none', item_id: 'i-none', name: 'Lẻ', sort_order: -5, category: null, line_at: at(1) }),
        pLine({ line_id: 'paper', item_id: 'i-paper', name: 'A4', sort_order: 0, category: paper, line_at: at(2) }),
        pLine({ line_id: 'pen-b', item_id: 'i-pen-b', name: 'bút bi', sort_order: 10, category: pen, line_at: at(3) }),
        pLine({ line_id: 'pen-a', item_id: 'i-pen-a', name: 'Ấn', sort_order: 10, category: pen, line_at: at(4) }),
        pLine({ line_id: 'pen-0', item_id: 'i-pen-0', name: 'Zeta', sort_order: 5, category: pen, line_at: at(5) }),
        pLine({ line_id: 'debt', period_ym: '2026-09', is_debt: true, item_id: 'i-z', name: 'Zz', sort_order: 99, category: null, line_at: at(6) }),
      ],
    });
    expect(dialogRows(p, priorityOf([p])).map((r) => r.line.line_id)).toEqual(['debt', 'pen-0', 'pen-b', 'pen-a', 'paper', 'none', 'custom']);
  });
});

describe('totalsOf / stepsOf — tổng và thứ tự gửi', () => {
  const debt = pLine({ line_id: 'd', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', qty: 4, remaining_qty: 4, stock_qty: 9 });
  const cur = pLine({ line_id: 'c', name: 'Bút', qty: 5, remaining_qty: 5, stock_qty: 9 });
  const adm = pLine({ line_id: 'm', item_id: 'i-clip', name: 'Kẹp', qty: 2, remaining_qty: 2, stock_qty: 1, adm_out: true, delivered_qty: 0 });

  it('tổng: giao, còn chưa nhận, nợ, số món NCC hủy', () => {
    const p = person({ lines: [cur, adm, debt] });
    const rows = dialogRows(p, priorityOf([p]));
    const lim = limitsOf(rows, { c: 3, d: 4 });
    expect(totalsOf(rows, lim)).toEqual({ give: 8, left: 2, debt: 0, cancel: 1 });
  });

  it('thứ tự: nợ trước, kỳ này, rồi hủy NCC (expected_delivered = đã giao + lần này)', () => {
    const p = person({ lines: [cur, adm, debt] });
    const rows = dialogRows(p, priorityOf([p]));
    const steps = stepsOf(rows, limitsOf(rows, {}));
    expect(steps.map((s) => [s.kind, s.line.line_id, s.kind === 'deliver' ? s.qty : s.expectedDelivered])).toEqual([
      ['deliver', 'd', 4],
      ['deliver', 'c', 5],
      ['deliver', 'm', 1],
      ['cancel', 'm', 1],
    ]);
  });

  it('dòng giao 0 không thành lệnh giao', () => {
    const p = person({ lines: [cur] });
    const rows = dialogRows(p, priorityOf([p]));
    expect(stepsOf(rows, limitsOf(rows, { c: 0 }))).toEqual([]);
  });
});

describe('stockShortages — W19', () => {
  it('tủ 3, hai người chờ 5 → 1 món thiếu 2; người đã nghỉ không tính', () => {
    const a = person({ user_sub: 'a', lines: [pLine({ line_id: 'a', remaining_qty: 2, stock_qty: 3 })] });
    const b = person({ user_sub: 'b', lines: [pLine({ line_id: 'b', remaining_qty: 3, stock_qty: 3 })] });
    const gone = person({ user_sub: 'g', user_status: 'inactive', lines: [pLine({ line_id: 'g', remaining_qty: 9, stock_qty: 3 })] });
    const s = stockShortages([a, b, gone]);
    expect(s.get('i-pen')).toEqual({ s: 3, k: 2, q: 5, short: 2 });
    expect(stockShortages([a]).size).toBe(0);
  });
});
