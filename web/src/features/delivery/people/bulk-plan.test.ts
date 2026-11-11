import { describe, expect, it } from 'vitest';
import { bulkPlan, withRejects } from './bulk-plan';
import { person, pLine } from './people-fixtures';

// Tủ bút 3: A (đăng ký trước) cần 2, C cần 4
const a = person({ user_sub: 'u-a', full_name: 'A', lines: [pLine({ line_id: 'la', request_id: 'r-a', remaining_qty: 2, qty: 2, stock_qty: 3, request_at: '2026-10-01T01:00:00.000000Z' })] });
const c = person({ user_sub: 'u-c', full_name: 'C', lines: [pLine({ line_id: 'lc', request_id: 'r-c', remaining_qty: 4, qty: 4, stock_qty: 3, request_at: '2026-10-02T01:00:00.000000Z' })] });

describe('bulkPlan', () => {
  it('A (kỳ 10, ưu tiên) cần 2, C cần 4, tủ 3 → body A 2, C 1; tổng 3 = tủ', () => {
    const { body, summary } = bulkPlan([a, c], [a, c]);
    expect(body.requests).toEqual([
      { request_id: 'r-a', lines: [{ line_id: 'la', qty: 2, expected_delivered_qty: 0 }] },
      { request_id: 'r-c', lines: [{ line_id: 'lc', qty: 1, expected_delivered_qty: 0 }] },
    ]);
    const total = body.requests.flatMap((r) => r.lines).reduce((n, l) => n + l.qty, 0);
    expect(total).toBe(3);
    expect(summary.find((s) => s.user_sub === 'u-c')).toMatchObject({ give: 1, left: 3 });
  });

  it('chỉ chọn C khi A vẫn chờ: C chỉ nhận phần tủ còn sau A (1), không lấn phần của A', () => {
    expect(bulkPlan([c], [a, c]).body.requests[0].lines[0].qty).toBe(1);
  });

  it('người có dòng ở hai kỳ → hai phần tử requests theo request_id', () => {
    const two = person({
      user_sub: 'u-t',
      full_name: 'T',
      lines: [
        pLine({ line_id: 't0', request_id: 'r-t0', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', remaining_qty: 1, qty: 1, stock_qty: 9 }),
        pLine({ line_id: 't1', request_id: 'r-t1', item_id: 'i-a4', remaining_qty: 2, qty: 2, stock_qty: 9 }),
      ],
    });
    const { body, owners } = bulkPlan([two], [two]);
    expect(body.requests.map((r) => r.request_id)).toEqual(['r-t0', 'r-t1']);
    expect(owners).toEqual({ 'r-t0': 'u-t', 'r-t1': 'u-t' });
  });

  it('dòng NCC hết hàng không vào body và không có bước hủy (bulk không hủy)', () => {
    const adm = person({ user_sub: 'u-m', lines: [pLine({ line_id: 'lm', request_id: 'r-m', item_id: 'i-x', stock_qty: 5, adm_out: true })] });
    const { body, skipped } = bulkPlan([adm], [adm]);
    expect(body.requests).toEqual([]);
    expect(skipped).toEqual([{ user_sub: 'u-m', reason: 'nothing' }]);
    expect(JSON.stringify(body)).not.toMatch(/cancel/);
  });

  it('người đã nghỉ đề xuất 0 → vào skipped, không có trong body', () => {
    const left = person({ user_sub: 'u-l', user_status: 'inactive', lines: [pLine({ line_id: 'll', request_id: 'r-l' })] });
    const { body, skipped } = bulkPlan([left], [left]);
    expect(body.requests).toEqual([]);
    expect(skipped).toEqual([{ user_sub: 'u-l', reason: 'nothing' }]);
  });

  it('expected_delivered_qty = delivered_qty hiện tại của dòng; tủ 0 hoặc dòng chờ duyệt → skipped', () => {
    const partial = person({ user_sub: 'u-p', lines: [pLine({ line_id: 'lp', request_id: 'r-p', qty: 10, delivered_qty: 7, remaining_qty: 3, stock_qty: 9 })] });
    expect(bulkPlan([partial], [partial]).body.requests[0].lines[0]).toEqual({ line_id: 'lp', qty: 3, expected_delivered_qty: 7 });
    const none = person({ user_sub: 'u-n', lines: [pLine({ line_id: 'ln', stock_qty: 0 })] });
    const pending = person({ user_sub: 'u-w', lines: [pLine({ line_id: 'lw', review_status: 'pending', item_id: null, stock_qty: null })] });
    expect(bulkPlan([none, pending], [none, pending]).skipped.map((s) => s.user_sub)).toEqual(['u-n', 'u-w']);
  });

  it('Phần thiếu tính cả dòng bỏ qua vì tủ hết và dòng NCC hết hàng, không tính dòng chờ duyệt', () => {
    const p = person({
      user_sub: 'u-s',
      lines: [
        pLine({ line_id: 's1', request_id: 'r-s', item_id: 'i-a', qty: 2, remaining_qty: 2, stock_qty: 9 }),
        pLine({ line_id: 's2', request_id: 'r-s', item_id: 'i-b', qty: 5, remaining_qty: 5, stock_qty: 0 }),
        pLine({ line_id: 's3', request_id: 'r-s', item_id: 'i-c', qty: 4, remaining_qty: 4, stock_qty: 9, adm_out: true }),
        pLine({ line_id: 's4', request_id: 'r-s', item_id: null, qty: 7, remaining_qty: 7, stock_qty: null, review_status: 'pending' }),
      ],
    });
    expect(bulkPlan([p], [p]).summary[0]).toMatchObject({ items: 1, give: 2, left: 9 });
  });

  it('món ngoài danh mục chờ duyệt của người được giao vào plan.pending; người không giao gì thì không; withRejects gắn reject_line_ids theo phiếu (phiếu chỉ có món chờ → lines rỗng)', () => {
    const rv = pLine({ line_id: 'rv', request_id: 'r-a', item_id: null, name: 'Kéo', review_status: 'pending', stock_qty: null });
    const rvDebt = pLine({ line_id: 'rv2', request_id: 'r-new', item_id: null, name: 'Hồ', review_status: 'pending', stock_qty: null });
    const pa = person({ user_sub: 'u-a', full_name: 'A', lines: [...a.lines, rv, rvDebt] });
    const idle = person({ user_sub: 'u-i', lines: [pLine({ line_id: 'ri', request_id: 'r-i', item_id: null, review_status: 'pending', stock_qty: null })] });
    const plan = bulkPlan([pa, idle], [pa, idle]);
    expect(plan.pending.map((l) => l.line_id).sort()).toEqual(['rv', 'rv2']);
    expect(plan.owners['r-new']).toBe('u-a');
    expect(withRejects(plan.body, plan.pending).requests).toEqual([
      { request_id: 'r-a', lines: [{ line_id: 'la', qty: 2, expected_delivered_qty: 0 }], reject_line_ids: ['rv'] },
      { request_id: 'r-new', lines: [], reject_line_ids: ['rv2'] },
    ]);
    expect(withRejects(plan.body, []).requests).toEqual(plan.body.requests);
  });
});
