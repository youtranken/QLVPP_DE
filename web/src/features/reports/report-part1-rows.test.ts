import { describe, expect, it } from 'vitest';
import { adminItem } from '@/features/summary/adjust-fixtures';
import { CUSTOM_GROUP, NONE_GROUP, part1Rows } from './report-part1-rows';
import { REPORT_CATEGORIES, REPORT_ITEMS, reportFixture } from './reports-fixtures';

const row = (key: string) => ({ key, item_id: key, name: key, name_en: null, unit: 'cai', requested: 1, backlog_prev: 0, stock: 0, need: 1 });

describe('part1Rows — nhóm Phần 1 theo danh mục sống (D7)', () => {
  it('nhóm theo sort_order của nhóm, rồi "Chưa xếp nhóm", ngoài danh mục cuối; trong nhóm giữ thứ tự server', () => {
    const report = reportFixture({ byItem: [row('item-glue'), row('item-pen'), row('item-x')] });
    const cats = [...REPORT_CATEGORIES].reverse();
    const out = part1Rows(report, [...REPORT_ITEMS, adminItem({ id: 'item-x', category_id: null })], cats);
    expect(out.map((r) => [r.id, r.group])).toEqual([
      ['item-pen', 'c-write'],
      ['item-glue', 'c-glue'],
      ['item-x', NONE_GROUP],
      [reportFixture().custom[0].key, CUSTOM_GROUP],
    ]);
    expect(out[0].packNote).toBe('Box of 20');
  });

  it('hai nhóm cùng sort_order → xếp theo tên như server', () => {
    const report = reportFixture({ byItem: [row('item-glue'), row('item-pen')], custom: [] });
    const cats = [
      { ...REPORT_CATEGORIES[1], sort_order: 5 },
      { ...REPORT_CATEGORIES[0], sort_order: 5 },
    ];
    expect(part1Rows(report, REPORT_ITEMS, cats).map((r) => r.group)).toEqual(['c-write', 'c-glue']);
  });

  it('category_id không còn trong danh sách nhóm, hoặc món không có trong admin/items → "Chưa xếp nhóm"', () => {
    const report = reportFixture({ byItem: [row('item-stale'), row('item-missing')], custom: [] });
    const out = part1Rows(report, [adminItem({ id: 'item-stale', category_id: 'c-deleted' })], REPORT_CATEGORIES);
    expect(out.map((r) => r.group)).toEqual([NONE_GROUP, NONE_GROUP]);
  });

  it('danh sách nhóm rỗng hoặc chưa tải → mọi món "Chưa xếp nhóm", không lỗi', () => {
    expect(part1Rows(reportFixture({ custom: [] }), REPORT_ITEMS, []).every((r) => r.group === NONE_GROUP)).toBe(true);
    expect(part1Rows(reportFixture({ custom: [] }), undefined, undefined).every((r) => r.group === NONE_GROUP)).toBe(true);
  });
});
