import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Database } from '../../database/database.module';
import {
  CUSTOM_ITEM_KEY,
  EFFECTIVE_LINE,
  REMAINING_QTY,
  UNDELIVERED_LINE,
} from '../requests/line-predicates';

type Row<T> = T & Record<string, unknown>;

export interface ItemDemand {
  item_id: string;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  active: boolean;
  stock: number;
  requested: number;
  backlog_prev: number;
}

export interface CustomDemand {
  key: string;
  name: string;
  unit: string;
  requested: number;
  backlog_prev: number;
  people: number;
}

export interface DetailLine {
  department: string | null;
  user_sub: string;
  full_name: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  qty: number;
}

// Kỳ ≤ ym: kỳ ym là "đăng ký kỳ này", kỳ trước là nợ (BR-15); chỉ dòng còn phần chưa giao/hủy
const demandSource = (ym: string) => sql`
  FROM request_lines l JOIN requests r ON r.id = l.request_id
  WHERE ${UNDELIVERED_LINE} AND r.period_ym <= ${ymToDate(ym)}::date`;
const splitByPeriod = (ym: string) => sql`
  coalesce(sum(${REMAINING_QTY}) FILTER (WHERE r.period_ym = ${ymToDate(ym)}::date), 0)::int AS requested,
  coalesce(sum(${REMAINING_QTY}) FILTER (WHERE r.period_ym < ${ymToDate(ym)}::date), 0)::int AS backlog_prev`;

export async function itemDemand(
  db: Database,
  ym: string,
): Promise<ItemDemand[]> {
  const { rows } = await db.execute<Row<ItemDemand>>(sql`
    SELECT i.id AS item_id, i.name, i.name_en, i.unit, i.pack_note, i.active,
           i.stock_qty AS stock, d.requested, d.backlog_prev
    FROM (SELECT l.item_id, ${splitByPeriod(ym)} ${demandSource(ym)}
            AND l.item_id IS NOT NULL GROUP BY l.item_id) d
    JOIN items i ON i.id = d.item_id
    ORDER BY i.sort_order, lower(i.name), i.id
  `);
  return rows;
}

// Tên hiển thị lấy theo dòng mới nhất (kỳ gần nhất) của nhóm
export async function customDemand(
  db: Database,
  ym: string,
): Promise<CustomDemand[]> {
  const { rows } = await db.execute<Row<CustomDemand>>(sql`
    SELECT ${CUSTOM_ITEM_KEY} AS key,
           (array_agg(trim(l.custom_name) ORDER BY r.period_ym DESC, l.created_at, l.id))[1] AS name,
           (array_agg(trim(l.custom_unit) ORDER BY r.period_ym DESC, l.created_at, l.id))[1] AS unit,
           ${splitByPeriod(ym)}, count(DISTINCT r.user_sub)::int AS people
    ${demandSource(ym)} AND l.item_id IS NULL
    GROUP BY 1
  `);
  return rows;
}

export async function detailLines(
  db: Database,
  ym: string,
): Promise<DetailLine[]> {
  const { rows } = await db.execute<Row<DetailLine>>(sql`
    SELECT r.department, r.user_sub, u.full_name,
           coalesce(i.name, trim(l.custom_name)) AS name, i.name_en,
           coalesce(i.unit, trim(l.custom_unit)) AS unit, l.qty
    FROM request_lines l
    JOIN requests r ON r.id = l.request_id
    JOIN users u ON u.sub = r.user_sub
    LEFT JOIN items i ON i.id = l.item_id
    WHERE ${EFFECTIVE_LINE} AND r.period_ym = ${ymToDate(ym)}::date
    ORDER BY r.department IS NULL, r.department, coalesce(u.full_name, ''), r.user_sub,
             coalesce(i.sort_order, 2147483647), lower(coalesce(i.name, l.custom_name)), l.id
  `);
  return rows;
}

export async function pendingCustomCount(
  db: Database,
  ym: string,
): Promise<number> {
  const { rows } = await db.execute<Row<{ n: number }>>(sql`
    SELECT count(*)::int AS n
    FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE l.review_status = 'pending' AND r.period_ym = ${ymToDate(ym)}::date
  `);
  return rows[0].n;
}
