import { describe, expect, it } from 'vitest';
import { filterPeople, lineMax, planOf, tabCounts, waitingFor } from './people-filter';
import { A, B, C, D, PEOPLE, person, pLine } from './people-fixtures';

const subs = (xs: { user_sub: string }[]) => xs.map((p) => p.user_sub);

describe('filterPeople', () => {
  it('mỗi tab chỉ giữ đúng trạng thái; "Tất cả" giữ hết', () => {
    expect(subs(filterPeople(PEOPLE, 'pending', ''))).toEqual(['u-a', 'u-b']);
    expect(subs(filterPeople(PEOPLE, 'debt', ''))).toEqual(['u-c']);
    expect(subs(filterPeople(PEOPLE, 'done', ''))).toEqual(['u-d']);
    expect(subs(filterPeople(PEOPLE, 'all', ''))).toEqual(['u-a', 'u-b', 'u-c', 'u-d']);
  });

  it('từ khóa bỏ dấu, không phân biệt hoa thường: "binh" khớp "Lê Thị Bình", "KIEN TRUC" khớp phòng', () => {
    expect(subs(filterPeople(PEOPLE, 'all', 'binh'))).toEqual(['u-b']);
    expect(subs(filterPeople(PEOPLE, 'all', ' KIEN TRUC '))).toEqual(['u-c']);
    expect(subs(filterPeople(PEOPLE, 'all', 'do mai'))).toEqual(['u-d']);
  });

  it('có từ khóa thì tìm trên mọi trạng thái, không giới hạn theo tab (như thiết kế)', () => {
    expect(subs(filterPeople(PEOPLE, 'pending', 'khoa'))).toEqual(['u-c']);
  });

  it('không khớp → rỗng; tên null không làm vỡ', () => {
    expect(filterPeople(PEOPLE, 'all', 'zzz')).toEqual([]);
    expect(subs(filterPeople([person({ user_sub: 'u-x', full_name: null, department: null })], 'all', 'x'))).toEqual([]);
  });
});

describe('tabCounts', () => {
  it('đếm theo trạng thái trên danh sách đầy đủ, không phụ thuộc từ khóa', () => {
    expect(tabCounts(PEOPLE)).toEqual({ pending: 2, debt: 1, done: 1, all: 4 });
    expect(tabCounts([])).toEqual({ pending: 0, debt: 0, done: 0, all: 0 });
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

describe('fixtures', () => {
  it('B có dòng nợ đứng trước', () => {
    expect(B.lines[0].is_debt).toBe(true);
    expect(C.request_id).toBeNull();
  });
});

describe('lineMax — trần stepper', () => {
  it.each([
    [10, 7, undefined, 7],
    [10, 10, undefined, 10],
    [10, 11, undefined, 10],
    [10, 0, undefined, 0],
    [10, null, undefined, 10],
    [10, 7, 2, 2],
    [10, 7, 9, 7],
    [10, 7, 0, 0],
  ])('cần %i, tủ %s, trần server %s → %i', (remaining, stock, cap, want) => {
    expect(lineMax(pLine({ remaining_qty: remaining, stock_qty: stock }), cap)).toBe(want);
  });
});

describe('planOf — nút nhanh trên thẻ', () => {
  it('đủ hàng: giao đủ, không thiếu', () => {
    expect(planOf(A)).toEqual({ give: 3, need: 3, short: false, deliverable: true });
  });

  it('B cần 10 bút tủ 7 + nợ 2 giấy tủ 5 → giao 9/12, thiếu', () => {
    expect(planOf(B)).toEqual({ give: 9, need: 12, short: true, deliverable: true });
  });

  it('tủ vừa đúng (3/3) vẫn đủ; tủ 2/3 là thiếu', () => {
    expect(planOf(person({ lines: [pLine({ stock_qty: 3 })] })).short).toBe(false);
    expect(planOf(person({ lines: [pLine({ stock_qty: 2 })] })).short).toBe(true);
  });

  it('dòng chờ duyệt và đã giao đủ không tính; người chỉ có dòng chờ duyệt không giao được', () => {
    const onlyReview = person({ lines: [pLine({ review_status: 'pending' })] });
    expect(planOf(onlyReview)).toEqual({ give: 0, need: 0, short: false, deliverable: false });
    expect(planOf(D)).toEqual({ give: 0, need: 0, short: false, deliverable: false });
  });
});
