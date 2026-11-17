import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { decodeTimestampCursor, encodeCursor } from '../../common/cursor';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { ITEM_COLUMNS } from './catalog-sql';
import { ITEM_ORDER } from './item-order';
import type { ItemDbRow, ItemRow } from './catalog-sql';
import {
  catalogStates,
  lowStockIds,
  stockList,
  withStockState,
} from './stock-list';
import type { StockListRow } from './stock-list';

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

interface Keyed extends Record<string, unknown> {
  id: string;
  cursor_ts: string;
}

@Injectable()
export class StockQueryService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly periods: PeriodsService,
  ) {}

  async list(now: Date): Promise<StockListRow[]> {
    const { openYm, kStar } = await this.periods.stockPeriods(now);
    return stockList(this.db, openYm, kStar);
  }

  movements(itemId: string, limit: number, cursor?: string) {
    return this.page(
      // Dòng giao không ghi người nhận ở sổ kho: lấy chủ phiếu qua dòng phiếu để Lịch sử nhập xuất viết "Giao … cho <tên>"
      // receipt_ym (kỳ của lần hàng về) để web viết "Hàng về tháng …" mà không phải đọc lại ghi chú máy
      sql`SELECT m.id, m.delta, m.reason, m.note, m.actor_sub, m.recipient_sub,
                 rq.user_sub AS delivered_to_sub,
                 to_char(m.receipt_ym, 'YYYY-MM') AS receipt_ym,
                 m.created_at, m.created_at::text AS cursor_ts
          FROM stock_movements m
          LEFT JOIN request_lines rl ON rl.id = m.ref_line_id
          LEFT JOIN requests rq ON rq.id = rl.request_id
          WHERE m.item_id = ${itemId}`,
      limit,
      cursor,
    );
  }

  myIssues(sub: string, limit: number, cursor?: string) {
    return this.page(
      sql`SELECT m.id, m.item_id, i.name AS item_name, i.name_en AS item_name_en,
                 i.unit, i.pack_note, -m.delta AS qty, m.note, m.created_at,
                 m.created_at::text AS cursor_ts
          FROM stock_movements m JOIN items i ON i.id = m.item_id
          WHERE m.reason = 'issue' AND m.recipient_sub = ${sub}`,
      limit,
      cursor,
    );
  }

  // Báo cáo đọc-only: được join users để hiện tên người nhận và người xuất
  async issuesInMonth(ym: string, db: Executor = this.db) {
    const start = sql`(${ym} || '-01')::timestamp`;
    const result = await db.execute(sql`
      SELECT m.id, m.item_id, i.name AS item_name, i.name_en AS item_name_en,
             i.unit, -m.delta AS qty,
             m.recipient_sub, u.full_name AS recipient_name, m.note, m.actor_sub,
             a.full_name AS actor_name, m.created_at
      FROM stock_movements m
      JOIN items i ON i.id = m.item_id
      LEFT JOIN users u ON u.sub = m.recipient_sub
      LEFT JOIN users a ON a.sub = m.actor_sub
      WHERE m.reason = 'issue'
        AND m.created_at >= ${start} AT TIME ZONE 'Asia/Ho_Chi_Minh'
        AND m.created_at < (${start} + interval '1 month') AT TIME ZONE 'Asia/Ho_Chi_Minh'
      ORDER BY m.created_at, m.id
    `);
    return result.rows;
  }

  async lowStock(now: Date): Promise<ItemRow[]> {
    const { openYm, kStar } = await this.periods.stockPeriods(now);
    const states = await catalogStates(this.db, openYm, kStar);
    const result = await this.db.execute<ItemDbRow>(sql`
      SELECT i.* FROM (
        SELECT ${ITEM_COLUMNS} FROM items
        WHERE active AND id = ANY(${sql.param(lowStockIds(states))}::uuid[])
      ) i
      LEFT JOIN item_categories c ON c.id = i.category_id
      ORDER BY ${ITEM_ORDER}
    `);
    return withStockState(result.rows, states);
  }

  // Mới nhất trước; khóa (created_at dạng text đủ micro giây, id) để trang sau không trùng/sót
  private async page(
    base: SQL,
    limit: number,
    cursor?: string,
  ): Promise<Page<Record<string, unknown>>> {
    const after = cursor ? decodeTimestampCursor(cursor) : null;
    const result = await this.db.execute<Keyed>(sql`
      SELECT * FROM (${base}) q
      WHERE ${after === null} OR (q.created_at, q.id) < (${after?.[0] ?? null}::timestamptz, ${after?.[1] ?? null}::uuid)
      ORDER BY q.created_at DESC, q.id DESC
      LIMIT ${limit + 1}
    `);
    const rows = result.rows.slice(0, limit);
    const last = rows[rows.length - 1];
    return {
      items: rows.map((r) =>
        Object.fromEntries(
          Object.entries(r).filter(([k]) => k !== 'cursor_ts'),
        ),
      ),
      next_cursor:
        result.rows.length > limit && last
          ? encodeCursor([last.cursor_ts, last.id])
          : null,
    };
  }
}
