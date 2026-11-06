import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareItems, orderKeyOf, type ItemOrderKey } from './item-order';

interface OrderFixture {
  categories: { id: string; name: string; sort_order: number }[];
  items: { id: string; name: string; sort_order: number; category_id: string | null }[];
  expected: string[];
}

// Cùng tệp api/test/item-order.e2e-spec.ts dùng để kiểm dãy SQL (ITEM_ORDER)
const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, 'item-order.fixture.json'), 'utf8')) as OrderFixture;

const key = (id: string, name: string, sort_order: number, category: ItemOrderKey['category'] = null): ItemOrderKey => ({ id, name, sort_order, category });
const ids = (list: ItemOrderKey[]) => [...list].sort(compareItems).map((k) => k.id);

describe('compareItems', () => {
  it('cho đúng dãy id mà API trả (fixture chung với e2e), bất kể thứ tự đầu vào', () => {
    const byId = new Map(FIXTURE.categories.map((c) => [c.id, c]));
    const keys = FIXTURE.items.map((i) => orderKeyOf(i, byId));
    expect(ids(keys)).toEqual(FIXTURE.expected);
    expect(ids([...keys].reverse())).toEqual(FIXTURE.expected);
  });

  it('món chưa nhóm (hoặc nhóm không còn) đứng cuối dù sort_order nhỏ nhất', () => {
    const cat = { name: 'Bút', sort_order: 900 };
    expect(ids([key('loose', 'A', -100), key('in', 'Z', 999, cat)])).toEqual(['in', 'loose']);
    expect(orderKeyOf({ id: 'x', name: 'X', sort_order: 1, category_id: 'gone' }, new Map()).category).toBeNull();
  });

  it('nhóm: sort_order rồi tên nhóm chữ thường theo mã điểm: "bút" trước "Giấy", "…a" trước "…B" khi cùng số', () => {
    const giay = { name: 'Giấy', sort_order: 10 };
    const but = { name: 'bút', sort_order: 10 };
    expect(ids([key('g', 'A', 0, giay), key('b', 'Z', 9, but)])).toEqual(['b', 'g']);
    expect(ids([key('B', 'A', 0, { name: 'Kẹp B', sort_order: 15 }), key('a', 'Z', 9, { name: 'Kẹp a', sort_order: 15 })])).toEqual(['a', 'B']);
    expect(ids([key('b', 'A', 0, { ...but, sort_order: 50 }), key('g', 'Z', 0, giay)])).toEqual(['g', 'b']);
  });

  it('trùng sort_order → tên chữ thường theo mã điểm → id; "đ" sau "e" (không localeCompare)', () => {
    expect(ids([key('2', 'Bút', 10), key('1', 'an', 10)])).toEqual(['1', '2']);
    expect(ids([key('b', 'bút', 10), key('a', 'Bút', 10)])).toEqual(['a', 'b']);
    expect(ids([key('d', 'đinh', 10), key('e', 'eke', 10)])).toEqual(['e', 'd']);
    expect('đinh'.localeCompare('eke', 'vi')).toBeLessThan(0);
  });

  it('sort_order món thắng tên', () => {
    expect(ids([key('z', 'A', 20), key('a', 'Z', 10)])).toEqual(['a', 'z']);
  });
});
