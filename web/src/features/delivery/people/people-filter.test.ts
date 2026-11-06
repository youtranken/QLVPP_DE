import { describe, expect, it } from 'vitest';
import { cardSummary, filterPeople, overlapCount, tabCounts, waitingFor } from './people-filter';
import { A, B, C, D, PEOPLE, person, pLine } from './people-fixtures';

const subs = (xs: { user_sub: string }[]) => xs.map((p) => p.user_sub);

describe('filterPeople', () => {
  it('tab lọc theo cờ, không theo status: Chưa nhận = has_pending, Còn nợ = has_debt (B có cả hai ở cả hai tab), Đã nhận = không cờ; "Tất cả" giữ hết', () => {
    expect(subs(filterPeople(PEOPLE, 'pending', ''))).toEqual(['u-a', 'u-b']);
    expect(subs(filterPeople(PEOPLE, 'debt', ''))).toEqual(['u-b', 'u-c']);
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
    expect(tabCounts(PEOPLE)).toEqual({ pending: 2, debt: 2, done: 1, all: 4 });
    expect(tabCounts([])).toEqual({ pending: 0, debt: 0, done: 0, all: 0 });
  });
});

describe('overlapCount', () => {
  it('số người có cả Chưa nhận và Còn nợ: B → 1; không ai → 0', () => {
    expect(overlapCount(PEOPLE)).toBe(1);
    expect(overlapCount([A, C, D])).toBe(0);
  });
});

describe('cardSummary', () => {
  it('đếm dòng chưa nhận + nợ còn giao được: 4 món · 18 đơn vị; bỏ dòng chờ duyệt và dòng đã giao đủ', () => {
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
    expect(cardSummary(p)).toEqual({ n: 4, u: 18 });
    expect(cardSummary(D)).toEqual({ n: 0, u: 0 });
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
