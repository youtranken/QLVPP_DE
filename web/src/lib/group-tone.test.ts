import { describe, expect, it } from 'vitest';
import { groupTone } from './group-tone';

const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, sort_order: i * 10 }));

describe('groupTone', () => {
  it('nhóm hạng 0 là g1, hạng 6 là g7', () => {
    const c = cats(8);
    expect(groupTone(c, 'c0')).toBe('g1');
    expect(groupTone(c, 'c6')).toBe('g7');
  });
  it('hạng 7 lặp về g1 (biên 7/8)', () => {
    expect(groupTone(cats(8), 'c7')).toBe('g1');
  });
  it('xếp theo sort_order chứ không theo thứ tự mảng', () => {
    const c = [{ id: 'b', sort_order: 2 }, { id: 'a', sort_order: 1 }];
    expect(groupTone(c, 'a')).toBe('g1');
    expect(groupTone(c, 'b')).toBe('g2');
  });
  it('cùng sort_order thì sắp theo id', () => {
    const c = [{ id: 'z', sort_order: 1 }, { id: 'a', sort_order: 1 }];
    expect(groupTone(c, 'a')).toBe('g1');
    expect(groupTone(c, 'z')).toBe('g2');
  });
  it('categoryId null → g0', () => {
    expect(groupTone(cats(3), null)).toBe('g0');
  });
  it('categoryId không có trong danh sách → g0', () => {
    expect(groupTone(cats(3), 'nope')).toBe('g0');
  });
  it('danh sách rỗng → g0', () => {
    expect(groupTone([], 'c0')).toBe('g0');
  });
  it('nhóm đã ngừng vẫn giữ hạng vì danh sách chứa mọi nhóm', () => {
    const c = cats(3);
    expect(groupTone(c, 'c2')).toBe('g3');
  });
});
