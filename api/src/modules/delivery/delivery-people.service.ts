import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { hasItemsSql } from '../reports/sent-snapshot';
import { addMonths, ymToDate } from '../../common/period';
import { ITEM_ORDER } from '../catalog/item-order';
import {
  CUSTOM_ITEM_KEY,
  DEBT_LINE_SQL,
  EFFECTIVE_LINE,
  lockedPeriod,
  REMAINING_QTY,
} from '../requests/line-predicates';
import type {
  DeliveryPerson,
  DeliveryPersonLine,
  DeliveryPersonStatus,
} from './delivery.dto';

type Row = DeliveryPersonLine & {
  user_sub: string;
  full_name: string | null;
  department: string | null;
  user_status: string;
  ready_now: boolean;
} & Record<string, unknown>;

// Dòng kỳ ym + nợ các kỳ trước; holds = được giữ chỗ theo thứ tự đăng ký (người đã nghỉ không giữ)
const baseCte = (ym: string, openYm: string) => sql`base AS (
  SELECT r.user_sub, u.full_name, u.department, u.status AS user_status,
         l.id AS line_id, l.request_id, r.period_ym, r.created_at AS request_at, l.created_at AS line_at,
         l.item_id, coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key,
         coalesce(i.name, trim(l.custom_name)) AS name, i.name_en,
         coalesce(i.unit, trim(l.custom_unit)) AS unit,
         coalesce(i.image_file_id, l.image_file_id) AS image_file_id,
         l.qty, l.delivered_qty, l.cancelled_qty, ${REMAINING_QTY} AS remaining_qty,
         i.stock_qty, l.review_status, ${EFFECTIVE_LINE} AS effective,
         (${EFFECTIVE_LINE} AND u.status = 'active') AS holds
  FROM request_lines l
  JOIN requests r ON r.id = l.request_id
  JOIN users u ON u.sub = r.user_sub
  LEFT JOIN items i ON i.id = l.item_id
  WHERE ${lockedPeriod(openYm)}
    AND ((r.period_ym = ${ymToDate(ym)}::date AND l.review_status <> 'rejected')
      OR ${DEBT_LINE_SQL(ym)}))`;

const RANKED_CTE = sql`ranked AS (
  SELECT b.*,
         coalesce(sum(CASE WHEN b.holds THEN b.remaining_qty ELSE 0 END) OVER (
           PARTITION BY b.period_ym, b.key ORDER BY b.request_at, b.line_at, b.line_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)::int AS ahead,
         coalesce(sum(CASE WHEN b.holds THEN b.remaining_qty ELSE 0 END) OVER (
           PARTITION BY b.key ORDER BY b.period_ym, b.request_at, b.line_at, b.line_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)::int AS ahead_all
  FROM base b)`;

// Mỗi kỳ có dòng ngoài DM: bản in mới nhất, Σ đã về, Σ đã giao theo khóa — tính một lần, không theo từng dòng
const CUSTOM_FACTS_CTE = sql`custom_periods AS (
  SELECT DISTINCT period_ym FROM base WHERE item_id IS NULL
), sent AS (
  SELECT DISTINCT ON (rs.period_ym) rs.period_ym, rs.data->'order_qty' AS order_qty
  FROM report_snapshots rs JOIN custom_periods p ON p.period_ym = rs.period_ym
  WHERE ${hasItemsSql}
  ORDER BY rs.period_ym, rs.created_at DESC, rs.id DESC
), received AS (
  SELECT c.period_ym, c.line_key AS key, sum(c.qty)::int AS qty
  FROM custom_receipts c JOIN custom_periods p ON p.period_ym = c.period_ym
  GROUP BY 1, 2
), delivered AS (
  SELECT r.period_ym, ${CUSTOM_ITEM_KEY} AS key, sum(l.delivered_qty)::int AS qty
  FROM request_lines l JOIN requests r ON r.id = l.request_id
  JOIN custom_periods p ON p.period_ym = r.period_ym
  WHERE l.item_id IS NULL
  GROUP BY 1, 2
)`;

// Trần gợi ý theo thứ tự đăng ký (ahead); server ép tổng ở custom-cap.ts khi giao
const CAPPED_CTE = sql`capped AS (
  SELECT x.*, (x.item_id IS NULL AND coalesce(s.ordered, 0) > 0) AS custom_tracked,
         CASE WHEN x.item_id IS NOT NULL THEN NULL
              WHEN coalesce(s.ordered, 0) > 0 THEN LEAST(x.remaining_qty, GREATEST(0,
                coalesce(rc.qty, 0) - coalesce(dv.qty, 0) - x.ahead))::int
              ELSE x.remaining_qty END AS deliver_cap
  FROM ranked x
  LEFT JOIN LATERAL (SELECT (st.order_qty->>x.key)::int AS ordered FROM sent st
                     WHERE st.period_ym = x.period_ym) s ON x.item_id IS NULL
  LEFT JOIN received rc ON rc.period_ym = x.period_ym AND rc.key = x.key
  LEFT JOIN delivered dv ON dv.period_ym = x.period_ym AND dv.key = x.key)`;

// Gợi ý theo người đăng ký trước: món danh mục giao được khi tủ còn sau phần giữ cho các dòng đứng trước;
// người đã nghỉ được gợi ý 0 nên không giữ tủ của ai và không tính là giao được ngay
const READY_NOW = sql`
  CASE WHEN NOT x.effective OR x.remaining_qty <= 0 THEN false
       WHEN x.user_status <> 'active' THEN false
       WHEN x.item_id IS NULL THEN x.deliver_cap > 0
       ELSE coalesce(x.stock_qty, 0) > x.ahead_all END`;

const UTC_STAMP = (col: SQL) =>
  sql`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

// Đọc-only cho màn "Giao theo người": dòng kỳ ym + nợ các kỳ trước của từng người
@Injectable()
export class DeliveryPeopleService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
  ) {}

  async list(ym: string): Promise<{ ym: string; people: DeliveryPerson[] }> {
    const now = this.clock.now();
    await this.periods.assertLocked(ym, now);
    const open = await this.periods.openPeriod(this.db, now);
    const rows = await this.rows(ym, open.ym);
    return { ym, people: groupPeople(ym, rows) };
  }

  // Dòng ngoài DM có trong bản in của kỳ dòng: trần = hàng đã về − đã giao của khóa, chia theo thứ tự đăng ký
  private async rows(ym: string, openYm: string): Promise<Row[]> {
    const current = ymToDate(addMonths(openYm, -1));
    const { rows } = await this.db.execute<Row>(sql`
      WITH ${baseCte(ym, openYm)}, ${RANKED_CTE}, ${CUSTOM_FACTS_CTE}, ${CAPPED_CTE}
      SELECT x.user_sub, x.full_name, x.department, x.user_status, x.line_id, x.request_id,
             to_char(x.period_ym, 'YYYY-MM') AS period_ym, (x.period_ym < ${current}::date) AS is_debt,
             x.item_id, x.name, x.name_en, x.unit, x.image_file_id, x.qty, x.delivered_qty,
             x.cancelled_qty, x.remaining_qty, x.stock_qty, x.review_status,
             EXISTS (SELECT 1 FROM period_adm_out a WHERE a.period_ym = x.period_ym
                     AND a.line_key = x.key AND a.kind = 'out') AS adm_out,
             x.custom_tracked, x.deliver_cap, ${READY_NOW} AS ready_now,
             x.ahead_all AS ahead_qty, i.sort_order,
             CASE WHEN c.id IS NULL THEN NULL
                  ELSE json_build_object('name', c.name, 'sort_order', c.sort_order) END AS category,
             ${UTC_STAMP(sql`x.request_at`)} AS request_at, ${UTC_STAMP(sql`x.line_at`)} AS line_at
      FROM capped x
      LEFT JOIN items i ON i.id = x.item_id
      LEFT JOIN item_categories c ON c.id = i.category_id
      ORDER BY x.period_ym, (x.item_id IS NULL), ${ITEM_ORDER},
               lower(x.name) COLLATE "C", x.request_at, x.line_at, x.line_id
    `);
    return rows;
  }
}

function groupPeople(ym: string, rows: Row[]): DeliveryPerson[] {
  const byUser = new Map<string, DeliveryPerson>();
  for (const {
    user_sub,
    full_name,
    department,
    user_status,
    ready_now,
    ...line
  } of rows) {
    let person = byUser.get(user_sub);
    if (!person) {
      person = {
        user_sub,
        full_name,
        department,
        user_status,
        request_id: null,
        status: 'done',
        owed_lines: 0,
        open_lines: 0,
        has_pending: false,
        has_debt: false,
        deliverable_now: false,
        lines: [],
      };
      byUser.set(user_sub, person);
    }
    person.lines.push(line);
    if (line.period_ym === ym) person.request_id = line.request_id;
    if (line.remaining_qty > 0) {
      if (line.is_debt) person.owed_lines++;
      else person.open_lines++;
    }
    if (ready_now) person.deliverable_now = true;
  }
  const people = [...byUser.values()];
  for (const p of people) {
    p.has_pending = p.open_lines > 0;
    p.has_debt = p.owed_lines > 0;
    p.status = statusOf(p);
  }
  return people.sort(
    (a, b) =>
      (a.full_name ?? '').localeCompare(b.full_name ?? '', 'vi') ||
      a.user_sub.localeCompare(b.user_sub),
  );
}

// Giao một phần tháng đang giao vẫn là Chưa nhận; chỉ dòng kỳ trước mới là nợ
function statusOf(p: DeliveryPerson): DeliveryPersonStatus {
  if (p.has_pending) return 'pending';
  return p.has_debt ? 'debt' : 'done';
}
