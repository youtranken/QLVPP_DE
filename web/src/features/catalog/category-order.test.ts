import { describe, expect, it } from 'vitest';
import type { Category } from './catalog.api';
import { sortCategories } from './category-order';

const cat = (id: string, sort_order: number): Category => ({ id, name: id, name_en: null, sort_order, active: true });

describe('thứ tự nhóm', () => {
  it('sortCategories theo sort_order rồi id (giống groupTone)', () => {
    expect(sortCategories([cat('z', 5), cat('b', 1), cat('a', 1)]).map((c) => c.id)).toEqual(['a', 'b', 'z']);
  });
});
