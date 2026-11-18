import { describe, expect, it } from 'vitest';
import { cardSummary, waitingFor } from './people-filter';
import { A, B, C, D, PEOPLE, person, pLine } from './people-fixtures';

describe('cardSummary', () => {
  it('đếm món (không phải dòng) chưa nhận + nợ còn giao được: nợ + kỳ này cùng bút là 1 món → 3 món · 18 đơn vị; bỏ dòng chờ duyệt và dòng đã giao đủ', () => {
    const p = person({
      lines: [
        pLine({ line_id: 'x1', is_debt: true, period_ym: '2026-09', remaining_qty: 2 }),
        pLine({ line_id: 'x2', remaining_qty: 5 }),
        pLine({ line_id: 'x3', item_id: 'i-a4', remaining_qty: 3 }),
        pLine({ line_id: 'x4', item_id: 'i-clip', remaining_qty: 8 }),
        pLine({ line_id: 'x5', item_id: null, review_status: 'pending', remaining_qty: 2 }),
        pLine({ line_id: 'x6', item_id: 'i-tape', delivered_qty: 3, remaining_qty: 0 }),
      ],
    });
    expect(cardSummary(p)).toEqual({ n: 3, u: 18 });
    expect(cardSummary(D)).toEqual({ n: 0, u: 0 });
  });

  it('món ngoài danh mục gộp theo khóa server (tên + ĐVT trim, không phân biệt hoa thường): nợ "Kéo cắt giấy /Cái" + kỳ này " kéo cắt giấy/cái " là 1 món; khác ĐVT là món khác', () => {
    const custom = (line_id: string, name: string, unit: string, remaining_qty: number) =>
      pLine({ line_id, item_id: null, name, unit, review_status: 'accepted', remaining_qty });
    const p = person({
      lines: [custom('k1', 'Kéo cắt giấy ', 'Cái', 1), custom('k2', ' kéo cắt giấy', 'cái ', 2), custom('k3', 'Kéo cắt giấy', 'hộp', 1)],
    });
    expect(cardSummary(p)).toEqual({ n: 2, u: 4 });
  });
});

describe('waitingFor', () => {
  it('kịch bản bút: B xem bút → còn 1 người (A) chờ, cần thêm 3', () => {
    expect(waitingFor(PEOPLE, 'i-pen', 'u-b')).toEqual({ people: 1, qty: 3 });
  });

  it('không tính chính người đang xem, dòng đã giao đủ, dòng chờ duyệt, món khác', () => {
    expect(waitingFor(PEOPLE, 'i-pen', 'u-a')).toEqual({ people: 1, qty: 10 });
    expect(waitingFor(PEOPLE, 'i-none', 'u-a')).toEqual({ people: 0, qty: 0 });
    const pendingReview = person({ user_sub: 'u-r', lines: [pLine({ line_id: 'lr', review_status: 'pending' })] });
    expect(waitingFor([A, pendingReview, D], 'i-pen', 'u-a')).toEqual({ people: 0, qty: 0 });
  });

  it('một người có hai dòng cùng món (nợ + kỳ này) vẫn là 1 người, cộng dồn số cần', () => {
    expect(waitingFor(PEOPLE, 'i-a4', 'u-a')).toEqual({ people: 2, qty: 3 });
    const twice = person({ user_sub: 'u-t', lines: [pLine({ line_id: 't1', remaining_qty: 2 }), pLine({ line_id: 't2', remaining_qty: 4, is_debt: true })] });
    expect(waitingFor([twice], 'i-pen', 'u-z')).toEqual({ people: 1, qty: 6 });
  });
});

describe('waitingFor — người đã nghỉ', () => {
  it('người đã nghỉ còn chờ bút không tính vào "k người khác còn chờ" (như W19)', () => {
    const left = person({ user_sub: 'u-l', user_status: 'left', lines: [pLine({ line_id: 'll', remaining_qty: 4 })] });
    expect(waitingFor([A, left], 'i-pen', 'u-z')).toEqual(waitingFor([A], 'i-pen', 'u-z'));
  });
});

describe('fixtures', () => {
  it('B có dòng nợ đứng trước', () => {
    expect(B.lines[0].is_debt).toBe(true);
    expect(C.request_id).toBeNull();
  });
});
