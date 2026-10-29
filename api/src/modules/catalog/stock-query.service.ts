import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { decodeTimestampCursor, encodeCursor } from '../../common/cursor';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor } from '../../database/database.module';
import { ITEM_COLUMNS, LOW_STOCK_SQL } from './catalog-sql';
import type { ItemRow } from './catalog-sql';

// Định nghĩa ở catalog-sql để ITEM_COLUMNS dùng chung mà không vòng import
export { LOW_STOCK_SQL };

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
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  movements(itemId: string, limit: number, cursor?: string) {
    return this.page(
      sql`SELECT m.id, m.delta, m.reason, m.note, m.actor_sub, m.recipient_sub,
                 m.created_at, m.created_at::text AS cursor_ts
          FROM stock_movements m WHERE m.item_id = ${itemId}`,
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

  // Báo cáo đọc-only: được join users để hiện tên người nhận
  async issuesInMonth(ym: string, db: Executor = this.db) {
    const start = sql`(${ym} || '-01')::timestamp`;
    const result = await db.execute(sql`
      SELECT m.id, m.item_id, i.name AS item_name, i.name_en AS item_name_en,
             i.unit, -m.delta AS qty,
             m.recipient_sub, u.full_name AS recipient_name, m.note, m.actor_sub,
             m.created_at
      FROM stock_movements m
      JOIN items i ON i.id = m.item_id
      LEFT JOIN users u ON u.sub = m.recipient_sub
      WHERE m.reason = 'issue'
        AND m.created_at >= ${start} AT TIME ZONE 'Asia/Ho_Chi_Minh'
        AND m.created_at < (${start} + interval '1 month') AT TIME ZONE 'Asia/Ho_Chi_Minh'
      ORDER BY m.created_at, m.id
    `);
    return result.rows;
  }

  async lowStock(): Promise<ItemRow[]> {
    const result = await this.db.execute<ItemRow>(sql`
      SELECT ${ITEM_COLUMNS} FROM items
      WHERE active AND ${sql.raw(LOW_STOCK_SQL)}
      ORDER BY sort_order, lower(name)
    `);
    return result.rows;
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
