import { describe, expect, it } from 'vitest';
import { lineView } from '@/test/fixtures-request';
import { unitProgress, unitTotalsOf } from './delivery.api';

describe('tiến độ giao theo đơn vị — danh sách và chi tiết cùng một phép tính', () => {
  it('dòng chờ xem/từ chối không tính; dòng đã duyệt/chuyển DM có tính', () => {
    const lines = [
      lineView({ id: 'a', qty: 5, delivered_qty: 3 }),
      lineView({ id: 'b', qty: 3 }),
      lineView({ id: 'c', qty: 2, review_status: 'pending' }),
      lineView({ id: 'd', qty: 1, review_status: 'rejected' }),
      lineView({ id: 'e', qty: 4, delivered_qty: 1, review_status: 'accepted' }),
      lineView({ id: 'f', qty: 2, review_status: 'converted' }),
    ];
    expect(unitTotalsOf(lines)).toEqual({ total_qty: 14, delivered_qty: 4, cancelled_qty: 0 });
    expect(unitProgress(unitTotalsOf(lines))).toEqual({ done: 4, total: 14 });
  });

  it('phần đã hủy tính là xong: giao 3 + hủy 2 trên 5 → 5/5; giao 3 + hủy 1 → 4/5', () => {
    expect(unitProgress(unitTotalsOf([lineView({ qty: 5, delivered_qty: 3, cancelled_qty: 2 })]))).toEqual({ done: 5, total: 5 });
    expect(unitProgress(unitTotalsOf([lineView({ qty: 5, delivered_qty: 3, cancelled_qty: 1 })]))).toEqual({ done: 4, total: 5 });
  });

  it('dòng của danh sách (tổng server) cho cùng kết quả với tổng từ các dòng', () => {
    const lines = [lineView({ id: 'a', qty: 5, delivered_qty: 3, cancelled_qty: 1 }), lineView({ id: 'b', qty: 3 })];
    expect(unitProgress({ total_qty: 8, delivered_qty: 3, cancelled_qty: 1 })).toEqual(unitProgress(unitTotalsOf(lines)));
  });

  it('phiếu không còn dòng hiệu lực → 0/0', () => {
    expect(unitProgress(unitTotalsOf([lineView({ qty: 2, review_status: 'pending' })]))).toEqual({ done: 0, total: 0 });
  });
});
