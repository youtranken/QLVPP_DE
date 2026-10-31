import { describe, expect, it } from 'vitest';
import { compareCategories, groupTone } from './group-tone';

const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Nhóm ${i}`, sort_order: i * 10 }));

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
    const c = [{ id: 'b', name: 'B', sort_order: 2 }, { id: 'a', name: 'A', sort_order: 1 }];
    expect(groupTone(c, 'a')).toBe('g1');
    expect(groupTone(c, 'b')).toBe('g2');
  });
  it('cùng sort_order thì sắp theo tên không phân biệt hoa thường (như server lower(name)), rồi id', () => {
    const c = [{ id: 'a', name: 'giấy', sort_order: 1 }, { id: 'z', name: 'Bút', sort_order: 1 }];
    expect(groupTone(c, 'z')).toBe('g1');
    expect(groupTone(c, 'a')).toBe('g2');
    const same = [{ id: 'z', name: 'X', sort_order: 1 }, { id: 'a', name: 'x', sort_order: 1 }];
    expect(groupTone(same, 'a')).toBe('g1');
  });
  it('compareCategories dùng chung cho sắp nhóm', () => {
    const list = [{ id: '2', name: 'b', sort_order: 1 }, { id: '1', name: 'A', sort_order: 1 }, { id: '0', name: 'z', sort_order: 0 }];
    expect([...list].sort(compareCategories).map((c) => c.id)).toEqual(['0', '1', '2']);
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
  it('nhóm đã ngừng (active:false) vẫn giữ hạng', () => {
    const c = [...cats(2), { id: 'c2', name: 'Nhóm 2', sort_order: 20, active: false }, { id: 'c3', name: 'Nhóm 3', sort_order: 30 }];
    expect(groupTone(c, 'c2')).toBe('g3');
    expect(groupTone(c, 'c3')).toBe('g4');
  });
});
