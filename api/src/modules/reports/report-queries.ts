import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { ITEM_ORDER } from '../catalog/item-order';
import {
  CUSTOM_ITEM_KEY,
  EFFECTIVE_LINE,
  REMAINING_QTY,
  UNDELIVERED_LINE,
} from '../requests/line-predicates';

type Row<T> = T & Record<string, unknown>;

export interface ItemDemand {
  item_id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  stock: number;
  requested: number;
  backlog_prev: number;
  left_excluded: number;
  usable: boolean;
}

export interface CustomDemand {
  key: string;
  name: string;
  unit: string;
  requested: number;
  backlog_prev: number;
  left_excluded: number;
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
  LEFT JOIN users u ON u.sub = r.user_sub
  WHERE ${UNDELIVERED_LINE} AND r.period_ym <= ${ymToDate(ym)}::date`;
const splitByPeriod = (ym: string) => sql`
  coalesce(sum(${REMAINING_QTY}) FILTER (WHERE r.period_ym = ${ymToDate(ym)}::date), 0)::int AS requested,
  coalesce(sum(${REMAINING_QTY}) FILTER (WHERE r.period_ym < ${ymToDate(ym)}::date), 0)::int AS backlog_prev,
  coalesce(sum(${REMAINING_QTY}) FILTER (WHERE u.status IS DISTINCT FROM 'active'), 0)::int AS left_excluded`;

// Thứ tự món chung; bản chốt giữ thứ tự này cho phiếu đề xuất
export async function itemDemand(
  db: Executor,
  ym: string,
): Promise<ItemDemand[]> {
  const { rows } = await db.execute<Row<ItemDemand>>(sql`
    SELECT i.id AS item_id, i.code, i.name, i.name_en, i.unit, i.pack_note,
           i.stock_qty AS stock, d.requested, d.backlog_prev, d.left_excluded,
           (i.active AND coalesce(c.active, true)) AS usable
    FROM (SELECT l.item_id, ${splitByPeriod(ym)} ${demandSource(ym)}
            AND l.item_id IS NOT NULL GROUP BY l.item_id) d
    JOIN items i ON i.id = d.item_id
    LEFT JOIN item_categories c ON c.id = i.category_id
    ORDER BY ${ITEM_ORDER}
  `);
  return rows;
}

// Tên hiển thị lấy theo dòng mới nhất (kỳ gần nhất) của nhóm
export async function customDemand(
  db: Executor,
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
  db: Executor,
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
    LEFT JOIN item_categories c ON c.id = i.category_id
    WHERE ${EFFECTIVE_LINE} AND r.period_ym = ${ymToDate(ym)}::date
    ORDER BY r.department IS NULL, r.department, coalesce(u.full_name, ''), r.user_sub,
             l.item_id IS NULL, ${ITEM_ORDER}, lower(trim(l.custom_name)) COLLATE "C", l.id
  `);
  return rows;
}

export async function pendingCustomCount(
  db: Executor,
  ym: string,
): Promise<number> {
  const { rows } = await db.execute<Row<{ n: number }>>(sql`
    SELECT count(*)::int AS n
    FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE l.review_status = 'pending' AND r.period_ym = ${ymToDate(ym)}::date
  `);
  return rows[0].n;
}

export interface PendingCustomLine {
  line_id: string;
  name: string;
}

// Tên món ngoài danh mục còn chờ của kỳ cho cảnh báo lúc chốt (chỉ báo cáo sống, không vào bản chốt)
export async function pendingCustomLines(
  db: Executor,
  ym: string,
): Promise<PendingCustomLine[]> {
  const { rows } = await db.execute<Row<PendingCustomLine>>(sql`
    SELECT l.id AS line_id, trim(l.custom_name) AS name
    FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE l.review_status = 'pending' AND r.period_ym = ${ymToDate(ym)}::date
    ORDER BY lower(trim(l.custom_name)), l.id
  `);
  return rows;
}

export interface KeyProgress {
  registered: number;
  delivered: number;
  received: number;
}

// Cột sống của kỳ ym (Đăng ký sau điều chỉnh, Đã giao, Đã về) theo khóa, kể cả khóa đã giao xong
export async function periodProgress(
  db: Executor,
  ym: string,
): Promise<Record<string, KeyProgress>> {
  const k = ymToDate(ym);
  const { rows } = await db.execute<Row<KeyProgress & { key: string }>>(sql`
    SELECT key, sum(registered)::int AS registered, sum(delivered)::int AS delivered,
           sum(received)::int AS received
    FROM (
      SELECT coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key,
             l.qty - l.cancelled_qty AS registered, l.delivered_qty AS delivered, 0 AS received
      FROM request_lines l JOIN requests r ON r.id = l.request_id
      WHERE ${EFFECTIVE_LINE} AND r.period_ym = ${k}::date
      UNION ALL
      SELECT item_id::text, 0, 0, delta FROM stock_movements
      WHERE reason = 'purchase' AND receipt_ym = ${k}::date
      UNION ALL
      SELECT line_key, 0, 0, qty FROM custom_receipts WHERE period_ym = ${k}::date
    ) x GROUP BY key`);
  return Object.fromEntries(
    rows.map(({ key, registered, delivered, received }) => [
      key,
      { registered, delivered, received },
    ]),
  );
}
