import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { REMAINING_QTY, UNDELIVERED_LINE } from '../requests/line-predicates';
import { periodNotLocked } from './delivery-errors';
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
    const period = await this.periods.findSnapshot(ym);
    if (!period || now < period.deadline) throw periodNotLocked();
    const rows = await this.rows(ym, now);
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

  private async rows(ym: string, now: Date): Promise<Row[]> {
    const { rows } = await this.db.execute<Row>(sql`
      SELECT r.user_sub, u.full_name, u.department, u.status AS user_status,
             l.id AS line_id, l.request_id, to_char(r.period_ym, 'YYYY-MM') AS period_ym,
             (r.period_ym < ${`${ym}-01`}::date) AS is_debt,
             l.item_id, coalesce(i.name, trim(l.custom_name)) AS name, i.name_en,
             coalesce(i.unit, trim(l.custom_unit)) AS unit,
             coalesce(i.image_file_id, l.image_file_id) AS image_file_id,
             l.qty, l.delivered_qty, l.cancelled_qty, ${REMAINING_QTY} AS remaining_qty,
             i.stock_qty, l.review_status
      FROM request_lines l
      JOIN requests r ON r.id = l.request_id
      JOIN periods p ON p.ym = r.period_ym
      JOIN users u ON u.sub = r.user_sub
      LEFT JOIN items i ON i.id = l.item_id
      WHERE p.deadline <= ${now.toISOString()}::timestamptz
        AND ((r.period_ym = ${`${ym}-01`}::date AND l.review_status <> 'rejected')
          OR (r.period_ym < ${`${ym}-01`}::date AND ${UNDELIVERED_LINE}))
      ORDER BY r.period_ym, l.id
    `);
    return rows;
  }
}

function statusOf(p: DeliveryPerson): DeliveryPersonStatus {
  if (p.open_lines > 0) return 'pending';
  return p.owed_lines > 0 ? 'debt' : 'done';
}
