import { describe, expect, it } from 'vitest';
import { groupCounts } from './group-counts';

describe('groupCounts', () => {
  it('đếm theo khóa nhóm, giữ thứ tự gặp đầu tiên, nhóm "last" xếp cuối', () => {
    const rows = [{ g: 'none' }, { g: 'a' }, { g: 'b' }, { g: 'a' }, { g: 'none' }];
    const counts = groupCounts(rows, (r) => r.g, 'none');
    expect([...counts]).toEqual([
      ['a', 2],
      ['b', 1],
      ['none', 2],
    ]);
  });

  it('kiểu hàng Hàng về: category_id null đưa về nhóm chưa xếp', () => {
    const rows = [{ category_id: 'c1' }, { category_id: null }, { category_id: 'c1' }];
    expect(groupCounts(rows, (r) => r.category_id ?? 'none', 'none').get('c1')).toBe(2);
    expect(groupCounts([], (r: { k: string }) => r.k).size).toBe(0);
  });
});
