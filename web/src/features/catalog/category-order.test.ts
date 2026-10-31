import { describe, expect, it } from 'vitest';
import type { Category } from './catalog.api';
import { moveCategory, orderPatches, sortCategories } from './category-order';

const cat = (id: string, sort_order: number): Category => ({ id, name: id, name_en: null, sort_order, active: true });
const A = cat('a', 10);
const B = cat('b', 20);
const C = cat('c', 30);

describe('thứ tự nhóm', () => {
  it('sortCategories theo sort_order rồi id (giống groupTone)', () => {
    expect(sortCategories([cat('z', 5), cat('b', 1), cat('a', 1)]).map((c) => c.id)).toEqual(['a', 'b', 'z']);
  });

  it('moveCategory đổi chỗ với nhóm kề; ra ngoài biên thì giữ nguyên', () => {
    expect(moveCategory([A, B, C], 2, -1).map((c) => c.id)).toEqual(['a', 'c', 'b']);
    expect(moveCategory([A, B, C], 0, -1)).toEqual([A, B, C]);
    expect(moveCategory([A, B, C], 2, 1)).toEqual([A, B, C]);
  });

  it('orderPatches: sort_order = vị trí*10 (vị trí từ 1), chỉ nhóm đổi vị trí', () => {
    expect(orderPatches([A, C, B])).toEqual([
      { id: 'c', sort_order: 20 },
      { id: 'b', sort_order: 30 },
    ]);
    expect(orderPatches([A, B, C])).toEqual([]);
  });

  it('dữ liệu cũ 0,1,2: mọi nhóm có sort_order khác vị trí*10 đều được gán lại để thứ tự đúng sau khi lưu', () => {
    expect(orderPatches([cat('b', 1), cat('a', 0), cat('c', 2)])).toEqual([
      { id: 'b', sort_order: 10 },
      { id: 'a', sort_order: 20 },
      { id: 'c', sort_order: 30 },
    ]);
  });
});
