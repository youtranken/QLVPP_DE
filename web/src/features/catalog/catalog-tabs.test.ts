import { describe, expect, it } from 'vitest';
import { indexCategories, toRows } from './catalog-rows';
import { CATEGORIES, OLD, PAPER, PEN, PENCIL, adminItem } from './catalog-fixtures';
import { CATALOG_TABS, inTab, parseTab, tabCounts, type CatalogTab } from './catalog-tabs';

const rows = toRows([PAPER, PEN, PENCIL, OLD, adminItem({ id: 'i-untracked', stock_state: 'untracked' }), adminItem({ id: 'i-old-low', active: false, stock_state: 'low', missing_image: true, image_file_id: null })], indexCategories(CATEGORIES));
const tabsOf = (id: string) => CATALOG_TABS.filter((t) => inTab(rows.find((r) => r.id === id)!, t));

describe('inTab', () => {
  it('4 tab theo thứ tự Đang dùng · Sắp hết/hết · Chưa có ảnh · Đã ngừng', () => {
    expect(CATALOG_TABS).toEqual<CatalogTab[]>(['active', 'low', 'noImage', 'inactive']);
  });

  it('món đang dùng: luôn ở active; low = sắp hết HOẶC hết (stock_state low/out); noImage = thiếu ảnh', () => {
    expect(tabsOf('i-paper')).toEqual(['active', 'low', 'noImage']);
    expect(tabsOf('i-pencil')).toEqual(['active', 'low']);
    expect(tabsOf('i-pen')).toEqual(['active']);
    expect(tabsOf('i-untracked')).toEqual(['active']);
  });

  it('món ngừng chỉ ở inactive, dù thiếu ảnh hoặc sắp hết', () => {
    expect(tabsOf('i-old')).toEqual(['inactive']);
    expect(tabsOf('i-old-low')).toEqual(['inactive']);
  });

  it('tabCounts đếm đúng từng tab', () => {
    expect(tabCounts(rows)).toEqual({ active: 4, low: 2, noImage: 1, inactive: 2 });
  });
});

describe('parseTab', () => {
  it.each([['low', 'low'], ['noImage', 'noImage'], ['inactive', 'inactive'], ['active', 'active'], [null, 'active'], ['bậy', 'active']])('%s → %s', (raw, tab) => {
    expect(parseTab(raw)).toBe(tab);
  });
});
