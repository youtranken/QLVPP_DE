import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { decodeCursor, encodeCursor, invalidCursor } from '../../common/cursor';
import { ymToDate } from '../../common/period';
import { YM } from '../../common/ym';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import {
  CATALOG_LINE,
  EFFECTIVE_LINE,
  REMAINING_QTY,
  UNDELIVERED_LINE,
} from './line-predicates';

export interface HistoryItem {
  period_ym: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  remaining_qty: number;
  cancelled_qty: number;
  // Số dòng hiệu lực còn chờ giao: chip "Còn chờ k món" của Lịch sử khỏi phải tải từng phiếu
  owed_line_count: number;
  // Phiếu còn giữ nhưng Hành chính đã bỏ hết dòng: Lịch sử ghi rõ thay vì "Không có phiếu"
  removed_all: boolean;
  custom: {
    pending: number;
    accepted: number;
    converted: number;
    rejected: number;
  };
  // Cùng các số trên nhưng chỉ dòng món trong danh mục, không tạm ngưng (CATALOG_LINE): Lịch sử
  // đếm "N món · U đơn vị" và chip giao theo một luật, món ngoài DM chỉ hiện ở dòng custom
  catalog: {
    line_count: number;
    qty: number;
    delivered_qty: number;
    remaining_qty: number;
    owed_line_count: number;
  };
}

type CatalogColumns = {
  cat_line_count: number;
  cat_qty: number;
  cat_delivered_qty: number;
  cat_remaining_qty: number;
  cat_owed_line_count: number;
};

type HistoryRow = Omit<HistoryItem, 'custom' | 'catalog'> &
  CatalogColumns & {
    pending: number;
    accepted: number;
    converted: number;
    rejected: number;
  };

// Chỉ dòng hiệu lực → total = delivered + cancelled + remaining; pending/rejected đếm riêng ở custom
const effective = (expr: SQL) =>
  sql`coalesce(sum(${expr}) FILTER (WHERE ${EFFECTIVE_LINE}), 0)::int`;
const catalog = (expr: SQL) =>
  sql`coalesce(sum(${expr}) FILTER (WHERE ${CATALOG_LINE}), 0)::int`;
const count = (status: string) =>
  sql`count(*) FILTER (WHERE l.review_status = ${status})::int`;

const HISTORY_COLUMNS = sql`to_char(r.period_ym, 'YYYY-MM') AS period_ym,
             count(l.id)::int AS line_count,
             ${effective(sql`l.qty`)} AS total_qty,
             ${effective(sql`l.delivered_qty`)} AS delivered_qty,
             ${effective(sql`l.cancelled_qty`)} AS cancelled_qty,
             ${effective(REMAINING_QTY)} AS remaining_qty,
             count(l.id) FILTER (WHERE ${UNDELIVERED_LINE})::int AS owed_line_count,
             (count(l.id) = 0 AND EXISTS (
               SELECT 1 FROM request_line_adjustments a WHERE a.request_id = r.id
             )) AS removed_all,
             ${count('pending')} AS pending, ${count('accepted')} AS accepted,
             ${count('converted')} AS converted, ${count('rejected')} AS rejected,
             count(l.id) FILTER (WHERE ${CATALOG_LINE})::int AS cat_line_count,
             ${catalog(sql`l.qty`)} AS cat_qty,
             ${catalog(sql`l.delivered_qty`)} AS cat_delivered_qty,
             ${catalog(REMAINING_QTY)} AS cat_remaining_qty,
             count(l.id) FILTER (WHERE ${CATALOG_LINE} AND ${REMAINING_QTY} > 0)::int AS cat_owed_line_count`;

@Injectable()
export class HistoryService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  // Mỗi người một phiếu/kỳ → period_ym đủ làm khóa keyset, mới nhất trước
  async list(
    userSub: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: HistoryItem[]; next_cursor: string | null }> {
    const after = cursor ? parseCursor(cursor) : null;
    const { rows } = await this.db.execute<
      HistoryRow & Record<string, unknown>
    >(sql`
      SELECT ${HISTORY_COLUMNS}
      FROM requests r LEFT JOIN request_lines l ON l.request_id = r.id
      WHERE r.user_sub = ${userSub}
        AND (${after === null} OR r.period_ym < ${after ? ymToDate(after) : null}::date)
      GROUP BY r.id, r.period_ym
      ORDER BY r.period_ym DESC
      LIMIT ${limit + 1}
    `);
    const page = rows.slice(0, limit);
    return {
      items: page.map(toItem),
      next_cursor:
        rows.length > limit
          ? encodeCursor([page[page.length - 1].period_ym])
          : null,
    };
  }

  // G3: Adm D&E xem phiếu từng tháng của một người trong một năm; request_id để mở chi tiết phiếu
  async forYear(
    userSub: string,
    year: number,
  ): Promise<(HistoryItem & { request_id: string })[]> {
    const { rows } = await this.db.execute<
      HistoryRow & { request_id: string } & Record<string, unknown>
    >(sql`
      SELECT r.id AS request_id, ${HISTORY_COLUMNS}
      FROM requests r LEFT JOIN request_lines l ON l.request_id = r.id
      WHERE r.user_sub = ${userSub}
        AND r.period_ym >= make_date(${year}::int, 1, 1)
        AND r.period_ym < make_date(${year}::int + 1, 1, 1)
      GROUP BY r.id, r.period_ym
      ORDER BY r.period_ym DESC
    `);
    return rows.map((row) => ({ ...toItem(row), request_id: row.request_id }));
  }
}

export function toItem({
  pending,
  accepted,
  converted,
  rejected,
  cat_line_count,
  cat_qty,
  cat_delivered_qty,
  cat_remaining_qty,
  cat_owed_line_count,
  ...rest
}: HistoryRow): HistoryItem {
  return {
    ...rest,
    custom: { pending, accepted, converted, rejected },
    catalog: {
      line_count: cat_line_count,
      qty: cat_qty,
      delivered_qty: cat_delivered_qty,
      remaining_qty: cat_remaining_qty,
      owed_line_count: cat_owed_line_count,
    },
  };
}

function parseCursor(raw: string): string {
  const [ym] = decodeCursor(raw, 1);
  if (!YM.test(ym)) throw invalidCursor();
  return ym;
}
