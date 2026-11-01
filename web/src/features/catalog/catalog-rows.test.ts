import { describe, expect, it } from 'vitest';
import { NO_GROUP, applyView, type CatalogView, catalogStats, groupCounts, indexCategories, toRows } from './catalog-rows';
import { CATEGORIES, OLD, PAPER, PEN, PENCIL, STRAY, adminItem } from './catalog-fixtures';

const ALL = [PEN, OLD, STRAY, PENCIL, PAPER];
const view: CatalogView = { cat: null, q: '', inactive: false, filter: null };

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
    expect(catalogStats(many, CATEGORIES).noImage).toBe(145);
  });
});

describe('catalogStats', () => {
  it('chỉ đếm món đang dùng: sắp hết, hết hàng, thiếu ảnh; số nhóm đang dùng; số món đã ngừng', () => {
    expect(catalogStats(ALL, CATEGORIES)).toEqual({ active: 4, groups: 2, low: 1, out: 1, noImage: 1, inactive: 1 });
  });

  it('"Đang dùng" không đếm món còn active nhưng nhóm đang ngừng (usable=false); món đó cũng không tính là đã ngừng', () => {
    const paused = adminItem({ id: 'i-paused', name: 'Bút dạ quang', usable: false });
    const stats = catalogStats([...ALL, paused], CATEGORIES);
    expect(stats.active).toBe(4);
    expect(stats.inactive).toBe(1);
  });
});

describe('applyView', () => {
  const rows = toRows(ALL, indexCategories(CATEGORIES));
  const ids = (v: Partial<CatalogView>) => applyView(rows, { ...view, ...v }).map((r) => r.id);

  it('mặc định ẩn món đã ngừng; inactive bật thì hiện', () => {
    expect(ids({})).not.toContain('i-old');
    expect(ids({ inactive: true })).toContain('i-old');
  });

  it('lọc nhóm theo cat; cat="none" lấy món chưa xếp nhóm', () => {
    expect(ids({ cat: 'c-pen' })).toEqual(['i-pen', 'i-pencil']);
    expect(ids({ cat: NO_GROUP })).toEqual(['i-stray']);
  });

  it('filter low/out/noimage', () => {
    expect(ids({ filter: 'low' })).toEqual(['i-paper']);
    expect(ids({ filter: 'out' })).toEqual(['i-pencil']);
    expect(ids({ filter: 'noimage' })).toEqual(['i-paper']);
  });

  it('tìm bỏ dấu theo tên, mã, quy cách', () => {
    expect(ids({ q: 'but bi' })).toEqual(['i-pen']);
    expect(ids({ q: 'vpp-001' })).toEqual(['i-paper']);
    expect(ids({ q: 'hộp 20' })).toEqual(['i-pen']);
  });
});
