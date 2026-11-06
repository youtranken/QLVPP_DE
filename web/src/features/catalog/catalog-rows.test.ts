import { describe, expect, it } from 'vitest';
import { NO_GROUP, applyView, type CatalogView, groupCounts, indexCategories, toRows } from './catalog-rows';
import { CATEGORIES, OLD, PAPER, PEN, PENCIL, STRAY, adminItem } from './catalog-fixtures';

const ALL = [PEN, OLD, STRAY, PENCIL, PAPER];
const view: CatalogView = { group: null, q: '' };

describe('toRows — nhóm theo thứ tự nhóm', () => {
  it('nhóm theo sort_order nhóm, trong nhóm theo sort_order món; "Chưa xếp nhóm" đứng cuối', () => {
    const rows = toRows(ALL, indexCategories(CATEGORIES));
    expect(rows.map((r) => r.id)).toEqual(['i-paper', 'i-pen', 'i-pencil', 'i-old', 'i-stray']);
    expect(rows.map((r) => r.group)).toEqual(['c-paper', 'c-pen', 'c-pen', 'c-pen', NO_GROUP]);
  });

  it('tông theo vị trí nhóm (g1 cho nhóm đầu); category_id lạ → g0, nhóm "Chưa xếp nhóm" (Review Focus 5)', () => {
    const rows = toRows(ALL, indexCategories(CATEGORIES));
    expect(rows.find((r) => r.id === 'i-paper')!.tone).toBe('g1');
    expect(rows.find((r) => r.id === 'i-pen')!.tone).toBe('g2');
    const stray = rows.find((r) => r.id === 'i-stray')!;
    expect(stray).toMatchObject({ group: NO_GROUP, tone: 'g0' });
  });

  it('trùng sort_order trong nhóm → tên chữ thường theo mã điểm rồi id, không localeCompare ("đ" sau "e")', () => {
    const items = [
      adminItem({ id: 'b', name: 'Đinh ghim', category_id: 'c-pen', sort_order: 10 }),
      adminItem({ id: 'z', name: 'eke', category_id: 'c-pen', sort_order: 10 }),
      adminItem({ id: 'a', name: 'EKE', category_id: 'c-pen', sort_order: 10 }),
    ];
    expect(toRows(items, indexCategories(CATEGORIES)).map((r) => r.id)).toEqual(['a', 'z', 'b']);
  });

  it('danh sách nhóm rỗng → mọi món về "Chưa xếp nhóm" tông g0, không lỗi', () => {
    const rows = toRows(ALL, indexCategories([]));
    expect(new Set(rows.map((r) => r.group))).toEqual(new Set([NO_GROUP]));
    expect(new Set(rows.map((r) => r.tone))).toEqual(new Set(['g0']));
  });

  it('145 món không ảnh, không nhóm: vẫn một nhóm "Chưa xếp nhóm", thiếu ảnh đếm đủ 145', () => {
    const many = Array.from({ length: 145 }, (_, i) =>
      adminItem({ id: `i-${i}`, name: `Món ${i}`, category_id: null, image_file_id: null, missing_image: true }),
    );
    const rows = toRows(many, indexCategories(CATEGORIES));
    expect(groupCounts(rows)).toEqual(new Map([[NO_GROUP, 145]]));
    expect(rows.filter((r) => r.missing_image)).toHaveLength(145);
  });
});

describe('applyView', () => {
  const rows = toRows(ALL, indexCategories(CATEGORIES));
  const ids = (v: Partial<CatalogView>) => applyView(rows, { ...view, ...v }).map((r) => r.id);

  it('lọc nhóm theo group; group="none" lấy món chưa xếp nhóm; không tự ẩn món ngừng (tab quyết định)', () => {
    expect(ids({ group: 'c-pen' })).toEqual(['i-pen', 'i-pencil', 'i-old']);
    expect(ids({ group: NO_GROUP })).toEqual(['i-stray']);
  });

  it('tìm bỏ dấu theo tên, mã, quy cách', () => {
    expect(ids({ q: 'but bi' })).toEqual(['i-pen']);
    expect(ids({ q: 'vpp-001' })).toEqual(['i-paper']);
    expect(ids({ q: 'hộp 20' })).toEqual(['i-pen']);
    expect(ids({ q: 'GIAY' })).toEqual(['i-paper']);
  });
});
