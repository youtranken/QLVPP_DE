import { describe, expect, it } from 'vitest';
import { requestStatus } from './request-status';

describe('requestStatus — một nhãn trạng thái phiếu, đếm theo đơn vị', () => {
  it('qty 9, giao 0 → notDelivered', () => {
    expect(requestStatus({ qty: 9, delivered: 0, cancelled: 0 })).toEqual({ key: 'notDelivered', delivered: 0, total: 9 });
  });
  it('giao 4/9 → partial "4/9"', () => {
    expect(requestStatus({ qty: 9, delivered: 4, cancelled: 0 })).toEqual({ key: 'partial', delivered: 4, total: 9 });
  });
  it('giao 8, còn 1 chưa giao (biên dưới) → partial; giao 9 → done', () => {
    expect(requestStatus({ qty: 9, delivered: 8, cancelled: 0 }).key).toBe('partial');
    expect(requestStatus({ qty: 9, delivered: 9, cancelled: 0 }).key).toBe('done');
  });
  it('giao 8, hủy phần còn lại 1 → done (hủy phần còn lại = xong), mẫu số 8', () => {
    expect(requestStatus({ qty: 9, delivered: 8, cancelled: 1 })).toEqual({ key: 'done', delivered: 8, total: 8 });
  });
  it('giao 4, hủy 2 của 10 → partial "4/8" (phần hủy ra khỏi mẫu số)', () => {
    expect(requestStatus({ qty: 10, delivered: 4, cancelled: 2 })).toEqual({ key: 'partial', delivered: 4, total: 8 });
  });
  it('còn nợ tháng trước 2 đơn vị → owed, n = 2 (ưu tiên hơn partial)', () => {
    expect(requestStatus({ qty: 9, delivered: 4, cancelled: 0, owedPrevMonths: 2 })).toEqual({ key: 'owed', delivered: 4, total: 9, n: 2 });
  });
  it('owedPrevMonths 0 → không owed', () => {
    expect(requestStatus({ qty: 9, delivered: 9, cancelled: 0, owedPrevMonths: 0 }).key).toBe('done');
  });
});
