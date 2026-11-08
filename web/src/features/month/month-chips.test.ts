import { describe, expect, it } from 'vitest';
import { chipCounts, chipOf, matchesChip } from './month-chips';

const row = (over: Partial<Parameters<typeof chipOf>[0]> = {}) => ({
  over_max: false,
  adjusted: false,
  custom_pending: 0,
  total_qty: 10,
  delivered_qty: 0,
  cancelled_qty: 0,
  ...over,
});

describe('chipOf: Có ghi chú', () => {
  it.each([
    ['vượt tối đa', { over_max: true }],
    ['HC đã điều chỉnh', { adjusted: true }],
    ['món ngoài DM chờ xem', { custom_pending: 1 }],
    ['không có gì để giao (tổng 0)', { total_qty: 0 }],
  ])('%s → noted', (_n, over) => {
    expect(chipOf(row(over)).noted).toBe(true);
  });
  it('phiếu thường (không điều kiện nào) → không noted; tổng 1 vẫn không noted', () => {
    expect(chipOf(row()).noted).toBe(false);
    expect(chipOf(row({ total_qty: 1 })).noted).toBe(false);
  });
  it('biên custom_pending: 0 không, 1 có', () => {
    expect(chipOf(row({ custom_pending: 0 })).noted).toBe(false);
    expect(chipOf(row({ custom_pending: 1 })).noted).toBe(true);
  });
});

describe('chipOf: Chưa giao xong', () => {
  it('giao + hủy = tổng → đã xong; thiếu 1 → chưa xong', () => {
    expect(chipOf(row({ delivered_qty: 7, cancelled_qty: 3 })).undelivered).toBe(false);
    expect(chipOf(row({ delivered_qty: 7, cancelled_qty: 2 })).undelivered).toBe(true);
  });
  it('tổng 0 → không có gì chờ giao (0 + 0 < 0 sai)', () => {
    expect(chipOf(row({ total_qty: 0 })).undelivered).toBe(false);
  });
});

describe('chipCounts và matchesChip', () => {
  const rows = [row({ over_max: true }), row({ delivered_qty: 10 }), row({ total_qty: 0 }), row()];
  it('đếm Tất cả / Có ghi chú / Chưa giao xong', () => {
    expect(chipCounts(rows)).toEqual({ all: 4, noted: 2, undelivered: 2 });
  });
  it('matchesChip lọc đúng từng chip', () => {
    expect(rows.filter((r) => matchesChip(r, 'all'))).toHaveLength(4);
    expect(rows.filter((r) => matchesChip(r, 'noted'))).toHaveLength(2);
    expect(rows.filter((r) => matchesChip(r, 'undelivered'))).toHaveLength(2);
  });
});
