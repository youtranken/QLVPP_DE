import { describe, expect, it } from 'vitest';
import type { Category } from '@/features/catalog/catalog.api';
import type { MemberItem } from './request.api';
import { applyFilters, DEFAULT_FILTER, filterPatch, groupCounts, parseFilter } from './item-filters';

const item = (id: string, name: string, cat: string, extra: Partial<MemberItem> = {}): MemberItem => ({
  id, name, name_en: null, unit: 'cai', pack_note: null, category_id: cat, image_file_id: null,
  admin_only: false, max_qty: 5, active: true, usable: true, ...extra,
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
const cart = (...keys: string[]) => ({ lines: keys.map((key) => ({ key })) });
const ids = (l: MemberItem[]) => l.map((i) => i.id);

describe('applyFilters', () => {
  it('"but bi" khớp "Bút bi Thiên Long" (bỏ dấu, không phân biệt hoa thường), khớp cả tên tiếng Anh', () => {
    expect(ids(applyFilters(ITEMS, cart(), { ...DEFAULT_FILTER, q: 'BUT BI' }, 'vi'))).toEqual(['1']);
    expect(ids(applyFilters(ITEMS, cart(), { ...DEFAULT_FILTER, q: 'binder' }, 'en'))).toEqual(['2']);
  });
  it('Đã chọn + từ khóa là giao hai điều kiện', () => {
    const f = { ...DEFAULT_FILTER, onlyPicked: true, q: 'giay' };
    expect(ids(applyFilters(ITEMS, cart('1', '3'), f, 'vi'))).toEqual(['3']);
    expect(ids(applyFilters(ITEMS, cart('1'), f, 'vi'))).toEqual([]);
  });
  it('nhóm lọc theo category', () => {
    expect(ids(applyFilters(ITEMS, cart(), { ...DEFAULT_FILTER, group: 'g1' }, 'vi'))).toEqual(['1', '3']);
  });
  it('az theo tiếng Việt: "Bìa" trước "Bút"', () => {
    expect(ids(applyFilters(ITEMS, cart(), { ...DEFAULT_FILTER, sort: 'az' }, 'vi'))).toEqual(['2', '1', '3']);
  });
  it('fav: món kỳ trước lên trước; không có dữ liệu thì như group', () => {
    const f = { ...DEFAULT_FILTER, sort: 'fav' as const };
    expect(ids(applyFilters(ITEMS, cart(), f, 'vi', new Set(['3'])))).toEqual(['3', '1', '2']);
    expect(ids(applyFilters(ITEMS, cart(), f, 'vi'))).toEqual(['1', '2', '3']);
    expect(ids(applyFilters(ITEMS, cart(), f, 'vi', new Set()))).toEqual(['1', '2', '3']);
  });
});

describe('groupCounts', () => {
  it('đếm theo nhóm, bỏ nhóm không có món, giữ thứ tự nhóm', () => {
    expect(groupCounts(ITEMS, CATS, 'vi', 'Khác')).toEqual([
      { id: 'g1', label: 'Bút', n: 2 },
      { id: 'g2', label: 'Bìa', n: 1 },
    ]);
    expect(groupCounts(ITEMS, CATS, 'en', 'Other')[0].label).toBe('Pens');
  });
});

describe('nhóm "Khác" (R-C7)', () => {
  const STRAY = [...ITEMS, item('4', 'Không nhóm', ''), item('5', 'Nhóm đã xóa', 'gone')].map((i) =>
    i.id === '4' ? { ...i, category_id: null } : i,
  );
  const known = new Set(CATS.map((c) => c.id));
  it('groupCounts thêm chip cuối "none" đếm món không nhóm + nhóm lạ; ẩn khi 0', () => {
    expect(groupCounts(STRAY, CATS, 'vi', 'Khác').at(-1)).toEqual({ id: 'none', label: 'Khác', n: 2 });
    expect(groupCounts(STRAY, CATS, 'en', 'Other').at(-1)?.label).toBe('Other');
    expect(groupCounts(ITEMS, CATS, 'vi', 'Khác').some((g) => g.id === 'none')).toBe(false);
  });
  it('applyFilters group=none chỉ giữ món category null hoặc không có trong danh sách nhóm', () => {
    const f = { ...DEFAULT_FILTER, group: 'none' };
    expect(ids(applyFilters(STRAY, cart(), f, 'vi', undefined, known))).toEqual(['4', '5']);
    expect(ids(applyFilters(STRAY, cart(), f, 'vi'))).toEqual(['4']);
  });
  it('parseFilter nhận g=none', () => {
    expect(parseFilter(new URLSearchParams('g=none'), ['g1'], 'all').group).toBe('none');
  });
});

describe('parseFilter', () => {
  const parse = (s: string, def = 'all') => parseFilter(new URLSearchParams(s), ['g1', 'g2'], def);
  it('sort lạ → group; g lạ → mặc định; picked khác 1 → false', () => {
    expect(parse('sort=xyz').sort).toBe('group');
    expect(parse('g=zzz')).toEqual(DEFAULT_FILTER);
    expect(parse('picked=yes').onlyPicked).toBe(false);
  });
  it('đọc đủ các khóa', () => {
    expect(parse('q=bi&g=g2&sort=az&picked=1')).toEqual({ q: 'bi', group: 'g2', sort: 'az', onlyPicked: true });
  });
  it('điện thoại: không có g → nhóm đầu; có q/picked → tìm mọi nhóm; g=all giữ "Tất cả"', () => {
    expect(parse('', 'g1').group).toBe('g1');
    expect(parse('q=bi', 'g1').group).toBe('all');
    expect(parse('picked=1', 'g1').group).toBe('all');
    expect(parse('g=all', 'g1').group).toBe('all');
    expect(parse('g=g2', 'g1').group).toBe('g2');
  });
});

describe('filterPatch', () => {
  it('giá trị mặc định xóa khóa', () => {
    expect(filterPatch({ q: ' ', sort: 'group', onlyPicked: false })).toEqual({ q: null, sort: null, picked: null });
    expect(filterPatch({ sort: 'az', onlyPicked: true, group: 'g1' })).toEqual({ sort: 'az', picked: '1', g: 'g1' });
  });
});
