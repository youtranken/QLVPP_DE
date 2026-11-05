import { describe, expect, it } from 'vitest';
import type { AdminItem } from '@/features/catalog/catalog.api';
import type { MonthReport, ReportItemRow } from '@/features/reports/reports.api';
import { arrivalTag, inactiveCount, parseQty, toArrivalRows } from './arrival-rows';

const row = (over: Partial<ReportItemRow>): ReportItemRow => ({
  key: 'k', item_id: 'i-a', code: 'A', name: 'Bút', name_en: null, unit: 'cay', requested: 0, backlog_prev: 0, stock: 0, need: 0, ...over,
});
const report = (byItem: ReportItemRow[], custom: MonthReport['custom'] = []): MonthReport => ({ ym: '2026-10', byItem, custom, byDepartment: [], issues: [], pending_custom_count: 0 });
const item = (over: Partial<AdminItem>): AdminItem => ({ id: 'i-a', name: 'Bút', image_file_id: 'f-1', stock_qty: 0, active: true, ...over }) as AdminItem;

describe('toArrivalRows — ví dụ chuẩn (A 3 + B 10, tủ 0)', () => {
  const rows = toArrivalRows(report([row({ requested: 13, need: 13 })]), [item({})]);

  it('một dòng, need 13: còn chờ 13, qty điền sẵn 13, tag Đủ', () => {
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ item_id: 'i-a', waiting: 13, stock: 0, qty: 13, image_file_id: 'f-1' });
    expect(arrivalTag(rows[0])).toBe('exact');
  });

  it('sửa qty 10 thì Thiếu, 14 thì Dư', () => {
    expect(arrivalTag({ ...rows[0], qty: 10 })).toBe('short');
    expect(arrivalTag({ ...rows[0], qty: 14 })).toBe('over');
  });
});

describe('toArrivalRows — chọn dòng', () => {
  it('tháng sau B nợ 3: waiting = requested + backlog_prev', () => {
    const [r] = toArrivalRows(report([row({ requested: 4, backlog_prev: 3, need: 7 })]), [item({})]);
    expect(r.waiting).toBe(7);
    expect(r.qty).toBe(7);
  });

  it('bỏ món need 0 và món không có item_id; tủ đủ thì không hiện', () => {
    const rows = toArrivalRows(report([row({ item_id: 'i-a', requested: 3, stock: 5, need: 0 }), row({ key: 'x', item_id: '', requested: 2, need: 2 })]), [item({})]);
    expect(rows).toEqual([]);
  });

  it('stock lấy từ tủ hiện tại của danh mục, need theo báo cáo', () => {
    const [r] = toArrivalRows(report([row({ requested: 10, stock: 2, need: 8 })]), [item({ stock_qty: 2 })]);
    expect(r).toMatchObject({ waiting: 10, stock: 2, qty: 8 });
    expect(arrivalTag(r)).toBe('exact');
  });
});

describe('parseQty — biên ô Về lần này', () => {
  it.each([
    ['0', 0, null],
    ['1', 1, null],
    ['99999', 99999, null],
    ['100000', 0, 'max'],
    ['-1', 0, 'invalid'],
    ['', 0, 'invalid'],
    ['1.5', 0, 'invalid'],
  ])('%j → qty %i lỗi %s', (raw, qty, error) => {
    expect(parseQty(raw)).toEqual({ qty, error });
  });
});

describe('món đã ngừng dùng', () => {
  const rep = report([row({ requested: 5, need: 5 }), row({ key: 'k2', item_id: 'i-off', requested: 2, need: 2 }), row({ key: 'k3', item_id: 'i-off2', requested: 0, need: 0 })]);
  const items = [item({}), item({ id: 'i-off', active: false }), item({ id: 'i-off2', active: false })];

  it('không có dòng sửa được cho món inactive, đếm đúng món inactive cần mua', () => {
    expect(toArrivalRows(rep, items).map((r) => r.item_id)).toEqual(['i-a']);
    expect(inactiveCount(rep, items)).toBe(1);
  });

  it('name_en lấy từ danh mục', () => {
    const [r] = toArrivalRows(report([row({ requested: 1, need: 1 })]), [item({ name_en: 'Pen' })]);
    expect(r.name_en).toBe('Pen');
  });
});
