import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { HistoryService, toItem } from './history.service';

const ROW = {
  period_ym: '2026-10',
  line_count: 7,
  total_qty: 12,
  delivered_qty: 5,
  remaining_qty: 6,
  cancelled_qty: 1,
  owed_line_count: 3,
  removed_all: false,
  pending: 1,
  accepted: 1,
  converted: 1,
  rejected: 1,
  cat_line_count: 3,
  cat_qty: 8,
  cat_delivered_qty: 4,
  cat_remaining_qty: 3,
  cat_owed_line_count: 2,
};

describe('HistoryService — số đếm chỉ món trong danh mục', () => {
  it('toItem gom cột cat_* thành catalog, cột trạng thái thành custom', () => {
    expect(toItem(ROW)).toEqual({
      period_ym: '2026-10',
      line_count: 7,
      total_qty: 12,
      delivered_qty: 5,
      remaining_qty: 6,
      cancelled_qty: 1,
      owed_line_count: 3,
      removed_all: false,
      custom: { pending: 1, accepted: 1, converted: 1, rejected: 1 },
      catalog: {
        line_count: 3,
        qty: 8,
        delivered_qty: 4,
        remaining_qty: 3,
        owed_line_count: 2,
      },
    });
  });

  it('cột catalog lọc review_status = n/a và bỏ dòng tạm ngưng; trả item đã gom', async () => {
    const execute = jest.fn().mockResolvedValue({ rows: [ROW] });
    const svc = new HistoryService({ execute } as unknown as Database);
    const res = await svc.list('u-1', 12);
    expect(res.items[0].catalog.qty).toBe(8);
    expect(res.next_cursor).toBeNull();
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as SQL);
    expect(query.sql).toContain(
      "count(l.id) FILTER (WHERE (l.review_status = 'n/a' AND NOT (l.item_id IS NOT NULL",
    );
    expect(query.sql).toMatch(/AS cat_qty/);
    expect(query.sql).toMatch(/AS cat_owed_line_count/);
  });
});
