import { describe, expect, it } from 'vitest';
import { compareUnits } from './unit-order';
import type { AdminUnit } from './units.api';

const u = (code: string, name: string, sort_order: number): AdminUnit => ({ code, name, name_en: null, sort_order, active: true, in_use: false, item_count: 0 });

describe('compareUnits', () => {
  it('sort_order, rồi tên không phân biệt hoa thường, rồi mã', () => {
    const list = [u('z', 'b', 2), u('y', 'B', 1), u('x', 'a', 1), u('w', 'a', 1)];
    expect([...list].sort(compareUnits).map((i) => i.code)).toEqual(['w', 'x', 'y', 'z']);
  });
});
