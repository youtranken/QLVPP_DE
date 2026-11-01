import { describe, expect, it } from 'vitest';
import { moveItem, orderPatches } from './local-order';

const x = (id: string, sort_order: number) => ({ id, sort_order });
const key = (i: { id: string }) => i.id;
const A = x('a', 10);
const B = x('b', 20);
const C = x('c', 30);

describe('thứ tự cục bộ', () => {
  it('moveItem đổi chỗ với mục kề; ra ngoài biên (đầu lên, cuối xuống) thì giữ nguyên', () => {
    expect(moveItem([A, B, C], 2, -1).map(key)).toEqual(['a', 'c', 'b']);
    expect(moveItem([A, B, C], 0, 1).map(key)).toEqual(['b', 'a', 'c']);
    expect(moveItem([A, B, C], 0, -1)).toEqual([A, B, C]);
    expect(moveItem([A, B, C], 2, 1)).toEqual([A, B, C]);
  });

  it('orderPatches: sort_order = vị trí*10 (từ 1), chỉ mục đổi số', () => {
    expect(orderPatches([A, C, B], key)).toEqual([
      { key: 'c', sort_order: 20 },
      { key: 'b', sort_order: 30 },
    ]);
    expect(orderPatches([A, B, C], key)).toEqual([]);
  });

  it('dữ liệu cũ 0,1,2: mọi mục lệch vị trí*10 đều được gán lại', () => {
    expect(orderPatches([x('b', 1), x('a', 0), x('c', 2)], key)).toEqual([
      { key: 'b', sort_order: 10 },
      { key: 'a', sort_order: 20 },
      { key: 'c', sort_order: 30 },
    ]);
  });
});
