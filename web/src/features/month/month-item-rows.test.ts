import { describe, expect, it } from 'vitest';
import type { ReportCustomRow, ReportItemRow } from '@/features/reports/reports.api';
import type { ItemSummaryRow } from '@/features/summary/summary.api';
import { monthItemRows } from './month-item-rows';

const row = (key: string, item_id: string | null, name: string, qty: number): ItemSummaryRow => ({ key, item_id, name, unit: 'cai', requested_qty: qty, people: 1, max_qty: null, over_max: false });
const custom = (key: string, need: number) => ({ key, name: key, unit: 'cai', requested: need, backlog_prev: 0, stock: null, need, people: 1 }) as ReportCustomRow;

describe('monthItemRows — Theo món', () => {
  it('hai món ngoài DM: mỗi dòng lấy Cần mua của chính nó theo key (3 và 4), không lặp tổng 7', () => {
    const rows = monthItemRows([row('custom:a', null, 'Ghim lạ', 3), row('custom:b', null, 'Bút lông', 4)], { byItem: [], custom: [custom('custom:a', 3), custom('custom:b', 4)] });
    expect(rows.map((r) => [r.name, r.need])).toEqual([['Ghim lạ', 3], ['Bút lông', 4]]);
  });

  it('món trong DM lấy tồn và Cần mua theo item_id; không có trong Báo cáo → tồn null, cần 0', () => {
    const byItem = [{ item_id: 'i-1', key: 'i-1', stock: 5, need: 2 } as ReportItemRow];
    const rows = monthItemRows([row('i-1', 'i-1', 'Bút', 7), row('i-2', 'i-2', 'Giấy', 1)], { byItem, custom: [] });
    expect(rows.map((r) => [r.stock, r.need])).toEqual([[5, 2], [null, 0]]);
  });
});
