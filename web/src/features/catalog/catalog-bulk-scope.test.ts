import { describe, expect, it } from 'vitest';
import { CATEGORIES, OLD, PEN, adminItem } from './catalog-fixtures';
import { indexCategories, toRows } from './catalog-rows';
import { bulkScope } from './catalog-bulk-scope';

const index = indexCategories(CATEGORIES);
const inPausedGroup = adminItem({ id: 'i-b', name: 'Kẹp B', category_id: 'c-old', usable: false, inactive_reason: 'group' });
const offInPausedGroup = adminItem({ id: 'i-c', name: 'Kẹp C', category_id: 'c-old', active: false });
const rows = toRows([PEN, OLD, inPausedGroup, offInPausedGroup], index);
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('bulkScope — thao tác hàng loạt theo nội dung lựa chọn', () => {
  it('món đang dùng → pausable; món ngừng riêng ở nhóm đang dùng → resumable; mọi món của nhóm tạm ngưng → locked', () => {
    const s = bulkScope(rows, new Set(['i-pen', 'i-old', 'i-b', 'i-c']), index);
    expect(ids(s.pausable)).toEqual(['i-pen']);
    expect(ids(s.resumable)).toEqual(['i-old']);
    expect(ids(s.locked).sort()).toEqual(['i-b', 'i-c']);
  });

  it('chỉ đếm món đã chọn', () => {
    const s = bulkScope(rows, new Set(['i-old']), index);
    expect([s.pausable.length, s.resumable.length, s.locked.length]).toEqual([0, 1, 0]);
  });

  it('món "Chưa xếp nhóm" (nhóm không còn) tính như nhóm đang dùng', () => {
    const stray = toRows([adminItem({ id: 'i-s', category_id: 'c-gone', active: false })], index);
    expect(ids(bulkScope(stray, new Set(['i-s']), index).resumable)).toEqual(['i-s']);
  });
});
