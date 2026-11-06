import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { hasItemsSql } from '../reports/sent-snapshot';
import {
  CUSTOM_ITEM_KEY,
  EFFECTIVE_LINE,
  lockedPeriod,
  REMAINING_QTY,
  UNDELIVERED_LINE,
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
} & Record<string, unknown>;

// Trần gợi ý theo thứ tự đăng ký (ahead); server ép tổng ở custom-cap.ts khi giao
const DELIVER_CAP = sql`
  CASE WHEN x.item_id IS NOT NULL THEN NULL
       WHEN coalesce(s.ordered, 0) > 0 THEN LEAST(x.remaining_qty, GREATEST(0,
         (SELECT coalesce(sum(c.qty), 0) FROM custom_receipts c
          WHERE c.period_ym = x.period_ym AND c.line_key = x.key)
         - (SELECT coalesce(sum(l.delivered_qty), 0)
            FROM request_lines l JOIN requests r ON r.id = l.request_id
            WHERE r.period_ym = x.period_ym AND l.item_id IS NULL
              AND ${CUSTOM_ITEM_KEY} = x.key)
         - x.ahead))::int
       ELSE x.remaining_qty END`;

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
    const byUser = new Map<string, DeliveryPerson>();
    for (const {
      user_sub,
      full_name,
      department,
      user_status,
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
          lines: [],
        };
        byUser.set(user_sub, person);
      }
      person.lines.push(line);
      if (!line.is_debt) person.request_id = line.request_id;
      if (line.remaining_qty > 0) {
        if (line.is_debt) person.owed_lines++;
        else person.open_lines++;
      }
    }
    const people = [...byUser.values()];
    for (const p of people) p.status = statusOf(p);
    people.sort(
      (a, b) =>
        (a.full_name ?? '').localeCompare(b.full_name ?? '', 'vi') ||
        a.user_sub.localeCompare(b.user_sub),
    );
    return { ym, people };
  }

  // Dòng ngoài DM có trong bản in của kỳ dòng: trần = hàng đã về − đã giao của khóa, chia theo thứ tự đăng ký
  private async rows(ym: string, openYm: string): Promise<Row[]> {
    const k = `${ym}-01`;
    const { rows } = await this.db.execute<Row>(sql`
      WITH base AS (
        SELECT r.user_sub, u.full_name, u.department, u.status AS user_status,
               l.id AS line_id, l.request_id, r.period_ym, r.created_at AS request_at, l.created_at AS line_at,
               l.item_id, coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key,
               coalesce(i.name, trim(l.custom_name)) AS name, i.name_en,
               coalesce(i.unit, trim(l.custom_unit)) AS unit,
               coalesce(i.image_file_id, l.image_file_id) AS image_file_id,
               l.qty, l.delivered_qty, l.cancelled_qty, ${REMAINING_QTY} AS remaining_qty,
               i.stock_qty, l.review_status, ${EFFECTIVE_LINE} AS effective
        FROM request_lines l
        JOIN requests r ON r.id = l.request_id
        JOIN users u ON u.sub = r.user_sub
        LEFT JOIN items i ON i.id = l.item_id
        WHERE ${lockedPeriod(openYm)}
          AND ((r.period_ym = ${k}::date AND l.review_status <> 'rejected')
            OR (r.period_ym < ${k}::date AND ${UNDELIVERED_LINE}))
      ), ranked AS (
        SELECT b.*,
               coalesce(sum(CASE WHEN b.effective THEN b.remaining_qty ELSE 0 END) OVER (
                 PARTITION BY b.period_ym, b.key ORDER BY b.request_at, b.line_at, b.line_id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)::int AS ahead
        FROM base b
      )
      SELECT x.user_sub, x.full_name, x.department, x.user_status, x.line_id, x.request_id,
             to_char(x.period_ym, 'YYYY-MM') AS period_ym, (x.period_ym < ${k}::date) AS is_debt,
             x.item_id, x.name, x.name_en, x.unit, x.image_file_id, x.qty, x.delivered_qty,
             x.cancelled_qty, x.remaining_qty, x.stock_qty, x.review_status,
             EXISTS (SELECT 1 FROM period_adm_out a WHERE a.period_ym = x.period_ym
                     AND a.line_key = x.key AND a.kind = 'out') AS adm_out,
             (x.item_id IS NULL AND coalesce(s.ordered, 0) > 0) AS custom_tracked,
             ${DELIVER_CAP} AS deliver_cap
      FROM ranked x
      LEFT JOIN LATERAL (
        SELECT (rs.data->'order_qty'->>x.key)::int AS ordered FROM report_snapshots rs
        WHERE rs.period_ym = x.period_ym AND ${hasItemsSql}
        ORDER BY rs.created_at DESC, rs.id DESC LIMIT 1
      ) s ON x.item_id IS NULL
      ORDER BY x.period_ym, x.line_id
    `);
    return rows;
  }
}

// Giao thiếu: mọi dòng mở của kỳ đã có delivered_qty > 0 → phần thiếu là nợ (Còn nợ), không còn "chưa nhận"
function statusOf(p: DeliveryPerson): DeliveryPersonStatus {
  const untouched = p.lines.some(
    (l) => !l.is_debt && l.remaining_qty > 0 && l.delivered_qty === 0,
  );
  if (untouched) return 'pending';
  return p.open_lines > 0 || p.owed_lines > 0 ? 'debt' : 'done';
}
