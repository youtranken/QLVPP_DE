import { describe, expect, it } from 'vitest';
import type { Category } from '@/features/catalog/catalog.api';
import type { MemberItem } from './request.api';
import { applyFilters, DEFAULT_FILTER, filterPatch, groupCounts, itemGroupOf, parseFilter } from './item-filters';

const item = (id: string, name: string, cat: string | null, extra: Partial<MemberItem> = {}): MemberItem => ({
  id, name, name_en: null, unit: 'cai', pack_note: null, category_id: cat, image_file_id: null, max_qty: 5, active: true, usable: true, ...extra,
});
const ITEMS = [
  item('1', 'Bút bi Thiên Long', 'g1'),
  item('2', 'Bìa còng', 'g2', { name_en: 'Binder' }),
  item('3', 'Giấy A4', 'g1'),
];
const CATS = [
  { id: 'g1', name: 'Bút', name_en: 'Pens' },
  { id: 'g2', name: 'Bìa', name_en: null },
  { id: 'g3', name: 'Trống', name_en: null },
] as Category[];
const OTHER = ['Khác', 'Other'];
const groupOf = itemGroupOf(CATS, OTHER);
const ids = (l: MemberItem[]) => l.map((i) => i.id);

describe('applyFilters', () => {
  it('"but bi" khớp "Bút bi Thiên Long" (bỏ dấu, không phân biệt hoa thường), khớp cả tên tiếng Anh', () => {
    expect(ids(applyFilters(ITEMS, { ...DEFAULT_FILTER, q: 'BUT BI' }, groupOf))).toEqual(['1']);
    expect(ids(applyFilters(ITEMS, { ...DEFAULT_FILTER, q: 'binder' }, groupOf))).toEqual(['2']);
  });
  it('nhóm lọc theo category; thứ tự cố định theo danh mục (không sắp xếp lại)', () => {
    expect(ids(applyFilters(ITEMS, { ...DEFAULT_FILTER, group: 'g1' }, groupOf))).toEqual(['1', '3']);
    expect(ids(applyFilters(ITEMS, DEFAULT_FILTER, groupOf))).toEqual(['1', '2', '3']);
  });
});

describe('groupCounts', () => {
  it('đếm theo nhóm, bỏ nhóm không có món, giữ thứ tự nhóm', () => {
    expect(groupCounts(ITEMS, CATS, 'vi', 'Khác', groupOf)).toEqual([
      { id: 'g1', label: 'Bút', n: 2 },
      { id: 'g2', label: 'Bìa', n: 1 },
    ]);
    expect(groupCounts(ITEMS, CATS, 'en', 'Other', groupOf)[0].label).toBe('Pens');
  });
});

describe('món chưa có nhóm gộp vào "Khác"', () => {
  const STRAY = [...ITEMS, item('4', 'Không nhóm', null), item('5', 'Nhóm đã xóa', 'gone')];
  it('không có nhóm tên "Khác": chip cuối "none" mang nhãn "Khác", đếm món không nhóm + nhóm lạ; ẩn khi 0', () => {
    expect(groupCounts(STRAY, CATS, 'vi', 'Khác', groupOf).at(-1)).toEqual({ id: 'none', label: 'Khác', n: 2 });
    expect(groupCounts(ITEMS, CATS, 'vi', 'Khác', groupOf).some((g) => g.id === 'none')).toBe(false);
    expect(ids(applyFilters(STRAY, { ...DEFAULT_FILTER, group: 'none' }, groupOf))).toEqual(['4', '5']);
  });
  it('có nhóm "Khác" (10 món): món không nhóm cộng dồn vào chip đó, không có chip "Chưa có nhóm" riêng', () => {
    const cats = [...CATS, { id: 'g9', name: 'Khác', name_en: 'Other' }] as Category[];
    const of = itemGroupOf(cats, OTHER);
    const items = [...STRAY, item('6', 'Kéo', 'g9')];
    const chips = groupCounts(items, cats, 'vi', 'Khác', of);
    expect(chips.filter((g) => g.label === 'Khác')).toEqual([{ id: 'g9', label: 'Khác', n: 3 }]);
    expect(chips.some((g) => g.id === 'none')).toBe(false);
    expect(ids(applyFilters(items, { ...DEFAULT_FILTER, group: 'g9' }, of))).toEqual(['4', '5', '6']);
  });
});

describe('parseFilter', () => {
  const parse = (s: string, def = 'all') => parseFilter(new URLSearchParams(s), ['g1', 'g2'], def);
  it('g lạ → mặc định; khóa cũ sort/picked trên URL bị bỏ qua', () => {
    expect(parse('g=zzz')).toEqual(DEFAULT_FILTER);
    expect(parse('sort=az&picked=1')).toEqual(DEFAULT_FILTER);
  });
  it('đọc q, g; nhận g=none', () => {
    expect(parse('q=bi&g=g2')).toEqual({ q: 'bi', group: 'g2' });
    expect(parse('g=none').group).toBe('none');
  });
  it('điện thoại: không có g → nhóm đầu; có q → tìm mọi nhóm; g=all giữ "Tất cả"', () => {
    expect(parse('', 'g1').group).toBe('g1');
    expect(parse('q=bi', 'g1').group).toBe('all');
    expect(parse('g=all', 'g1').group).toBe('all');
    expect(parse('g=g2', 'g1').group).toBe('g2');
  });
});

describe('filterPatch', () => {
  it('giá trị mặc định xóa khóa', () => {
    expect(filterPatch({ q: ' ' })).toEqual({ q: null });
    expect(filterPatch({ q: 'bi', group: 'g1' })).toEqual({ q: 'bi', g: 'g1' });
  });
});
