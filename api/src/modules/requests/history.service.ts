import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { decodeCursor, encodeCursor, invalidCursor } from '../../common/cursor';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';

export interface HistoryItem {
  period_ym: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  remaining_qty: number;
  cancelled_qty: number;
  custom: {
    pending: number;
    accepted: number;
    converted: number;
    rejected: number;
  };
}

type HistoryRow = Omit<HistoryItem, 'custom'> & {
  pending: number;
  accepted: number;
  converted: number;
  rejected: number;
};

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
// Chỉ dòng hiệu lực → total = delivered + cancelled + remaining; pending/rejected đếm riêng ở custom
const effective = (expr: SQL) =>
  sql`coalesce(sum(${expr}) FILTER (WHERE l.review_status IN ('n/a', 'accepted', 'converted')), 0)::int`;
const count = (status: string) =>
  sql`count(*) FILTER (WHERE l.review_status = ${status})::int`;

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
      SELECT to_char(r.period_ym, 'YYYY-MM') AS period_ym,
             count(l.id)::int AS line_count,
             ${effective(sql`l.qty`)} AS total_qty,
             ${effective(sql`l.delivered_qty`)} AS delivered_qty,
             ${effective(sql`l.cancelled_qty`)} AS cancelled_qty,
             ${effective(sql`l.qty - l.delivered_qty - l.cancelled_qty`)} AS remaining_qty,
             ${count('pending')} AS pending, ${count('accepted')} AS accepted,
             ${count('converted')} AS converted, ${count('rejected')} AS rejected
      FROM requests r LEFT JOIN request_lines l ON l.request_id = r.id
      WHERE r.user_sub = ${userSub}
        AND (${after === null} OR r.period_ym < ${after ? ymToDate(after) : null}::date)
      GROUP BY r.id, r.period_ym
      ORDER BY r.period_ym DESC
      LIMIT ${limit + 1}
    `);
    const page = rows.slice(0, limit);
    return {
      items: page.map(
        ({ pending, accepted, converted, rejected, ...rest }) => ({
          ...rest,
          custom: { pending, accepted, converted, rejected },
        }),
      ),
      next_cursor:
        rows.length > limit
          ? encodeCursor([page[page.length - 1].period_ym])
          : null,
    };
  }
}

function parseCursor(raw: string): string {
  const [ym] = decodeCursor(raw, 1);
  if (!YM.test(ym)) throw invalidCursor();
  return ym;
}
