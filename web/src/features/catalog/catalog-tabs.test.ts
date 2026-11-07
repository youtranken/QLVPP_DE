import { describe, expect, it } from 'vitest';
import { indexCategories, toRows } from './catalog-rows';
import { CATEGORIES, OLD, PAPER, PEN, PENCIL, adminItem } from './catalog-fixtures';
import { CATALOG_TABS, inTab, parseTab, tabCounts, type CatalogTab } from './catalog-tabs';

const byGroup = adminItem({ id: 'i-grp', category_id: 'c-old', usable: false, inactive_reason: 'group' });
const rows = toRows(
  [PAPER, PEN, PENCIL, OLD, byGroup, adminItem({ id: 'i-untracked', stock_state: 'untracked' }), adminItem({ id: 'i-old-low', active: false, stock_state: 'low', missing_image: true, image_file_id: null })],
  indexCategories(CATEGORIES),
);
const tabsOf = (id: string) => CATALOG_TABS.filter((t) => inTab(rows.find((r) => r.id === id)!, t));

describe('inTab', () => {
  it('4 tab theo thứ tự Tất cả · Đang dùng · Tạm ngưng · Chưa có ảnh', () => {
    expect(CATALOG_TABS).toEqual<CatalogTab[]>(['all', 'active', 'inactive', 'noImage']);
  });

  it('món dùng được: ở all và active, tồn không quyết định tab; noImage = dùng được mà thiếu ảnh', () => {
    expect(tabsOf('i-paper')).toEqual(['all', 'active', 'noImage']);
    expect(tabsOf('i-pencil')).toEqual(['all', 'active']);
    expect(tabsOf('i-untracked')).toEqual(['all', 'active']);
  });

  it('món tạm ngưng riêng chỉ ở all và inactive, dù thiếu ảnh hoặc sắp hết', () => {
    expect(tabsOf('i-old')).toEqual(['all', 'inactive']);
    expect(tabsOf('i-old-low')).toEqual(['all', 'inactive']);
  });

  it('món còn bật nhưng nhóm tạm ngưng (usable=false) cũng thuộc inactive, không thuộc active', () => {
    expect(tabsOf('i-grp')).toEqual(['all', 'inactive']);
  });

  it('tabCounts đếm đúng từng tab', () => {
    expect(tabCounts(rows)).toEqual({ all: 7, active: 4, inactive: 3, noImage: 1 });
  });
});

describe('parseTab', () => {
  it.each([['low', 'all'], ['noImage', 'noImage'], ['inactive', 'inactive'], ['active', 'active'], ['all', 'all'], [null, 'all'], ['bậy', 'all']])('%s → %s', (raw, tab) => {
    expect(parseTab(raw)).toBe(tab);
  });
});
