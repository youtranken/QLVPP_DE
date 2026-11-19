import { describe, expect, it } from 'vitest';
import { cutNote } from '@/lib/note-text';
import { lineView } from '@/test/fixtures-request';
import { canReduce, otherNoteMissing, reduceError, reduceRange } from './adjust-plan';
import { NOTE_MAX } from './use-adjust-dialog';

// Biên hai phía của hộp Điều chỉnh (review Phase 2b): "Giảm còn n" hợp lệ khi max(1, giao + hủy) ≤ n ≤ qty − 1
describe('adjust-plan — biên Giảm còn', () => {
  const line = lineView({ id: 'l', item_id: 'i', qty: 10, delivered_qty: 3, cancelled_qty: 1 });

  it('qty 10, đã giao 3 + hủy 1: 3 bị từ chối, 4 được (sàn); 9 được, 10 (= qty) bị từ chối', () => {
    expect(reduceRange(line)).toEqual({ min: 4, max: 9 });
    expect(reduceError(line, 3)).not.toBeNull();
    expect(reduceError(line, 4)).toBeNull();
    expect(reduceError(line, 9)).toBeNull();
    expect(reduceError(line, 10)).not.toBeNull();
  });

  it('chưa giao gì: 0 bị từ chối (giảm về 0 là Từ chối), 1 được', () => {
    const fresh = lineView({ id: 'f', item_id: 'i', qty: 5 });
    expect(reduceError(fresh, 0)).not.toBeNull();
    expect(reduceError(fresh, 1)).toBeNull();
  });

  it('A6 loại lỗi: dưới sàn → under (min); từ số đã đặt trở lên → over (ordered = qty); max được, max+1 over; 1 được, 0 under', () => {
    const fresh = lineView({ id: 'f', item_id: 'i', qty: 5 });
    expect(reduceError(fresh, 4)).toBeNull();
    expect(reduceError(fresh, 5)).toEqual({ kind: 'over', max: 4, ordered: 5 });
    expect(reduceError(fresh, 1)).toBeNull();
    expect(reduceError(fresh, 0)).toEqual({ kind: 'under', min: 1 });
    expect(reduceError(fresh, null)).toEqual({ kind: 'under', min: 1 });
    expect(reduceError(line, 3)).toEqual({ kind: 'under', min: 4 });
  });

  it('số không nguyên → notInt ("Nhập số nguyên"): 2.5 và 4.5 (giữa max và max+1) đều notInt, không phải over/under', () => {
    const fresh = lineView({ id: 'f', item_id: 'i', qty: 5 });
    expect(reduceError(fresh, 2.5)).toEqual({ kind: 'notInt' });
    expect(reduceError(fresh, 4.5)).toEqual({ kind: 'notInt' });
    expect(reduceError(fresh, 0.5)).toEqual({ kind: 'notInt' });
  });

  it('canReduce: qty 2 giao 0 hoặc 1 → còn giảm về 1; giao 2 → không; qty 1 → không', () => {
    expect(canReduce(lineView({ id: 'a', item_id: 'i', qty: 2 }))).toBe(true);
    expect(canReduce(lineView({ id: 'b', item_id: 'i', qty: 2, delivered_qty: 1 }))).toBe(true);
    expect(canReduce(lineView({ id: 'c', item_id: 'i', qty: 2, delivered_qty: 2 }))).toBe(false);
    expect(canReduce(lineView({ id: 'd', item_id: 'i', qty: 1 }))).toBe(false);
  });
});

describe('adjust-plan — biên ghi chú', () => {
  it('Khác: 2 chữ (sau trim) còn thiếu, 3 chữ đủ; lý do khác không đòi ghi chú', () => {
    expect(otherNoteMissing('other', ' ab ')).toBe(true);
    expect(otherNoteMissing('other', 'abc')).toBe(false);
    expect(otherNoteMissing('over_quota', '')).toBe(false);
  });

  it('ghi chú tối đa 200: 200 giữ nguyên, 201 cắt còn 200', () => {
    expect(NOTE_MAX).toBe(200);
    expect(cutNote('x'.repeat(200), NOTE_MAX)).toHaveLength(200);
    expect(cutNote('x'.repeat(201), NOTE_MAX)).toHaveLength(200);
  });
});
