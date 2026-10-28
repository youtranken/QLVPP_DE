import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import {
  addMonths,
  daysLeft,
  deadlineOf,
  periodFor,
  ymToDate,
} from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { SystemConfigService } from '../config/system-config.service';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Tx;

export interface Period {
  ym: string;
  deadline: Date;
}

export interface CurrentPeriod {
  ym: string;
  deadline: string;
  is_open: true;
  days_left: number;
  previous: { ym: string; delivering: boolean } | null;
}

// Đủ xa để vượt mọi kỳ đã khóa sẵn; vòng lặp chỉ chạy khi config bị nới sau khi kỳ đã qua hạn
const MAX_FORWARD_MONTHS = 24;

@Injectable()
export class PeriodsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly config: SystemConfigService,
  ) {}

  async ensurePeriod(ym: string, tx: Executor = this.db): Promise<Period> {
    const lastDay = await this.config.getInt('registration_last_day');
    // Hạn chốt lúc tạo; đổi config về sau không đổi kỳ đã có (BR-2)
    await tx.execute(sql`
      INSERT INTO periods (ym, deadline)
      VALUES (${ymToDate(ym)}::date, ${deadlineOf(ym, lastDay).toISOString()}::timestamptz)
      ON CONFLICT (ym) DO NOTHING
    `);
    // Đọc lại thấy dòng tx khác vừa chèn nhờ READ COMMITTED (mặc định); REPEATABLE READ sẽ không thấy
    const row = await this.find(ym, tx);
    if (!row) throw new Error(`Không đọc được kỳ ${ym} vừa tạo`);
    return row;
  }

  // now truyền vào để một request dùng đúng một mốc (openPeriod rồi isOpen không lệch nhau ở ranh giới)
  async openPeriod(
    tx: Executor = this.db,
    now: Date = this.clock.now(),
  ): Promise<Period> {
    const { rows } = await tx.execute<{ ym: string; deadline: Date }>(sql`
      SELECT to_char(ym, 'YYYY-MM') AS ym, deadline FROM periods
      WHERE deadline > ${now.toISOString()}::timestamptz
      ORDER BY ym LIMIT 1
    `);
    if (rows[0]) return toPeriod(rows[0]);
    const lastDay = await this.config.getInt('registration_last_day');
    let ym = periodFor(now, lastDay);
    for (let i = 0; i < MAX_FORWARD_MONTHS; i++, ym = addMonths(ym, 1)) {
      const period = await this.ensurePeriod(ym, tx);
      if (period.deadline > now) return period;
    }
    throw new Error(`Không tìm được kỳ mở sau ${ym}`);
  }

  async isOpen(
    ym: string,
    tx: Executor = this.db,
    now: Date = this.clock.now(),
  ): Promise<boolean> {
    const row = await this.find(ym, tx);
    return row !== null && now < row.deadline;
  }

  async current(userSub: string): Promise<CurrentPeriod> {
    const now = this.clock.now();
    const period = await this.openPeriod(this.db, now);
    const prevYm = addMonths(period.ym, -1);
    const { rows } = await this.db.execute<{ delivering: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM request_lines l
        WHERE l.request_id = r.id
          AND l.review_status IN ('n/a', 'accepted', 'converted')
          AND l.delivered_qty + l.cancelled_qty < l.qty
      ) AS delivering
      FROM requests r
      WHERE r.period_ym = ${ymToDate(prevYm)}::date AND r.user_sub = ${userSub}
    `);
    return {
      ym: period.ym,
      deadline: period.deadline.toISOString(),
      is_open: true,
      days_left: daysLeft(now, period.deadline),
      previous: rows[0] ? { ym: prevYm, delivering: rows[0].delivering } : null,
    };
  }

  private async find(ym: string, tx: Executor): Promise<Period | null> {
    const { rows } = await tx.execute<{ ym: string; deadline: Date }>(sql`
      SELECT to_char(ym, 'YYYY-MM') AS ym, deadline FROM periods
      WHERE ym = ${ymToDate(ym)}::date
    `);
    return rows[0] ? toPeriod(rows[0]) : null;
  }
}

// pg trả timestamptz là Date, nhưng giữ chắc khi driver đổi parser
function toPeriod(row: { ym: string; deadline: Date | string }): Period {
  return { ym: row.ym, deadline: new Date(row.deadline) };
}
