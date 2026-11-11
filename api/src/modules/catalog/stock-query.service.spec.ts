import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import type { PeriodsService } from '../periods/periods.service';
import { StockQueryService } from './stock-query.service';

function capture(rows: Record<string, unknown>[]) {
  const seen: string[] = [];
  const db = {
    execute: jest.fn((q: SQL) => {
      seen.push(new PgDialect().sqlToQuery(q).sql);
      return Promise.resolve({ rows });
    }),
  } as unknown as Database;
  return { svc: new StockQueryService(db, {} as PeriodsService), seen };
}

describe('StockQueryService.movements', () => {
  it('chọn receipt_ym dạng YYYY-MM và người nhận của dòng giao; bỏ cursor_ts khỏi kết quả', async () => {
    const row = {
      id: 'm1',
      delta: 5,
      reason: 'purchase',
      note: 'Về bù kỳ 2026-10',
      receipt_ym: '2026-10',
      delivered_to_sub: null,
      cursor_ts: '2026-11-01 08:00:00+07',
    };
    const { svc, seen } = capture([row]);
    const page = await svc.movements('item-1', 20);
    expect(seen[0]).toContain("to_char(m.receipt_ym, 'YYYY-MM') AS receipt_ym");
    expect(seen[0]).toContain('rq.user_sub AS delivered_to_sub');
    expect(page.items[0]).toMatchObject({
      receipt_ym: '2026-10',
      delivered_to_sub: null,
    });
    expect(page.items[0]).not.toHaveProperty('cursor_ts');
    expect(page.next_cursor).toBeNull();
  });
});
