import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { decodeCursor, encodeCursor, invalidCursor } from '../../common/cursor';
import { ymToDate } from '../../common/period';
import { escapeLike } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { CatalogService } from '../catalog/catalog.service';
import type { PeriodRequestsQuery, SummaryFilter } from './summary.dto';
import { EFFECTIVE_LINE, UNDELIVERED_LINE } from './summary.service';

export interface PersonRow {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  user_status: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  custom_pending: number;
  updated_at: string;
}

export interface ItemSummaryRow {
  key: string;
  item_id: string | null;
  name: string;
  unit: string;
  requested_qty: number;
  people: number;
}

type PersonDbRow = Omit<PersonRow, 'updated_at'> & {
  updated_at: Date | string;
} & Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Khóa sắp xếp: phòng ban NULL xếp cuối (false < true), rồi tên, rồi id cho duy nhất
const PERSON_ORDER = sql.raw(
  `(r.department IS NULL), coalesce(r.department, ''), coalesce(u.full_name, ''), r.id`,
);
const FILTERS: Record<SummaryFilter, SQL> = {
  all: sql`true`,
  pending_delivery: sql`count(l.id) FILTER (WHERE ${UNDELIVERED_LINE}) > 0`,
  custom_pending: sql`count(l.id) FILTER (WHERE l.review_status = 'pending') > 0`,
};
const effectiveSum = (col: string) =>
  sql`coalesce(sum(${sql.raw(col)}) FILTER (WHERE ${EFFECTIVE_LINE}), 0)::int`;

@Injectable()
export class SummaryListsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly catalog: CatalogService,
  ) {}

  async byPerson(
    ym: string,
    query: PeriodRequestsQuery,
  ): Promise<{ items: PersonRow[]; next_cursor: string | null }> {
    const after = query.cursor ? parsePersonCursor(query.cursor) : null;
    const like = query.q ? `%${escapeLike(query.q.trim())}%` : null;
    const { rows } = await this.db.execute<PersonDbRow>(sql`
      SELECT r.id AS request_id, r.user_sub, u.full_name, u.email, r.department,
             u.status AS user_status, count(l.id)::int AS line_count,
             ${effectiveSum('l.qty')} AS total_qty,
             ${effectiveSum('l.delivered_qty')} AS delivered_qty,
             count(l.id) FILTER (WHERE l.review_status = 'pending')::int AS custom_pending,
             r.updated_at
      FROM requests r
      JOIN users u ON u.sub = r.user_sub
      LEFT JOIN request_lines l ON l.request_id = r.id
      WHERE r.period_ym = ${ymToDate(ym)}::date
        AND (${like}::text IS NULL OR u.full_name ILIKE ${like} OR u.email ILIKE ${like})
        AND (${after === null} OR (${PERSON_ORDER}) > (${after?.[0] === '1'}, ${after?.[1] ?? ''},
             ${after?.[2] ?? ''}, ${after?.[3] ?? null}::uuid))
      GROUP BY r.id, u.sub
      HAVING ${FILTERS[query.filter]}
      ORDER BY ${PERSON_ORDER}
      LIMIT ${query.limit + 1}
    `);
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        ...row,
        updated_at: new Date(row.updated_at).toISOString(),
      })),
      next_cursor:
        rows.length > query.limit
          ? encodeCursor([
              last.department === null ? '1' : '0',
              last.department ?? '',
              last.full_name ?? '',
              last.request_id,
            ])
          : null,
    };
  }

  // Không phân trang: số món một kỳ nhỏ; dòng ngoài DM gộp theo tên chuẩn hóa + ĐVT
  async byItem(ym: string): Promise<{ items: ItemSummaryRow[] }> {
    const { rows } = await this.db.execute<
      Omit<ItemSummaryRow, 'name' | 'unit'> & {
        custom_name: string | null;
        custom_unit: string | null;
      }
    >(sql`
      SELECT coalesce(l.item_id::text,
               'custom:' || lower(trim(l.custom_name)) || '|' || l.custom_unit) AS key,
             l.item_id, min(trim(l.custom_name)) AS custom_name,
             min(l.custom_unit) AS custom_unit, sum(l.qty)::int AS requested_qty,
             count(DISTINCT r.user_sub)::int AS people
      FROM requests r JOIN request_lines l ON l.request_id = r.id
      WHERE r.period_ym = ${ymToDate(ym)}::date AND ${EFFECTIVE_LINE}
      GROUP BY 1, l.item_id
    `);
    const ids = rows.map((r) => r.item_id).filter((id): id is string => !!id);
    const facts = await this.catalog.itemFacts(ids);
    const items = rows.map(({ custom_name, custom_unit, ...row }) => {
      const item = row.item_id ? facts.get(row.item_id) : undefined;
      return {
        ...row,
        name: item?.name ?? custom_name ?? '',
        unit: item?.unit ?? custom_unit ?? '',
      };
    });
    return { items: items.sort((a, b) => a.name.localeCompare(b.name, 'vi')) };
  }
}

function parsePersonCursor(raw: string): string[] {
  const keys = decodeCursor(raw, 4);
  if (!['0', '1'].includes(keys[0]) || !UUID.test(keys[3])) {
    throw invalidCursor();
  }
  return keys;
}
