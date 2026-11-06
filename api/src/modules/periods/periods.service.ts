import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import {
  addMonths,
  deadlineOf,
  periodFor,
  ymToDate,
} from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { SystemConfigService } from '../config/system-config.service';
import { futurePeriod, lockState, periodNotLocked } from './period-lock';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Tx;

export interface Period {
  ym: string;
  deadline: Date;
}

export type PeriodSnapshot = Period & {
  headcount: number | null;
  headcount_subs: string[] | null;
};

// Đủ xa để vượt mọi kỳ đã khóa sẵn; vòng lặp chỉ chạy khi config bị nới sau khi kỳ đã qua hạn
const MAX_FORWARD_MONTHS = 24;

@Injectable()
export class PeriodsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly config: SystemConfigService,
    private readonly audit: AuditWriterService,
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

  // now truyền vào để một request dùng đúng một mốc với các luật kỳ khác ở ranh giới
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

  // Tổng hợp cần cả tập người đã chụp lúc khóa kỳ
  async findSnapshot(
    ym: string,
    tx: Executor = this.db,
  ): Promise<PeriodSnapshot | null> {
    const { rows } = await tx.execute<{
      deadline: Date;
      headcount: number | null;
      headcount_subs: string[] | null;
    }>(sql`
      SELECT deadline, headcount, headcount_subs FROM periods WHERE ym = ${ymToDate(ym)}::date
    `);
    return rows[0]
      ? {
          ym,
          deadline: new Date(rows[0].deadline),
          headcount: rows[0].headcount,
          headcount_subs: rows[0].headcount_subs,
        }
      : null;
  }

  // Kỳ trước kỳ mở luôn khóa, kể cả khi chưa có dòng periods
  async assertLocked(
    ym: string,
    now: Date,
    tx: Executor = this.db,
  ): Promise<void> {
    const open = await this.openPeriod(tx, now);
    const state = lockState(ym, open.ym);
    if (state === 'future') throw futurePeriod();
    if (state === 'open') throw periodNotLocked(open);
  }

  // Người gọi đã khóa dòng/phiếu FOR UPDATE nếu sắp ghi; kỳ của phiếu không đổi sau khi tạo
  async assertLineLocked(
    tx: Executor,
    lineId: string,
    now: Date,
  ): Promise<string | null> {
    const { rows } = await tx.execute<{ ym: string }>(sql`
      SELECT to_char(r.period_ym, 'YYYY-MM') AS ym
      FROM request_lines l JOIN requests r ON r.id = l.request_id
      WHERE l.id = ${lineId}
    `);
    if (!rows[0]) return null;
    await this.assertLocked(rows[0].ym, now, tx);
    return rows[0].ym;
  }

  async latestLocked(
    now: Date,
    tx: Executor = this.db,
  ): Promise<(Period & { headcount: number | null }) | null> {
    const { rows } = await tx.execute<{
      ym: string;
      deadline: Date;
      headcount: number | null;
    }>(sql`
      SELECT to_char(ym, 'YYYY-MM') AS ym, deadline, headcount FROM periods
      WHERE deadline <= ${now.toISOString()}::timestamptz
      ORDER BY ym DESC LIMIT 1
    `);
    return rows[0]
      ? { ...toPeriod(rows[0]), headcount: rows[0].headcount }
      : null;
  }

  // Chỉ ghi lần đầu: tập người chụp lúc khóa, chạy lại/đua không ghi đè; trả số đã lưu (bên thua đua nhận số của bên thắng)
  async recordHeadcount(ym: string, subs: string[], tx: Tx): Promise<number> {
    const updated = await tx.execute<{ headcount: number }>(sql`
      UPDATE periods SET headcount = ${subs.length}, headcount_subs = ${sql.param(subs)}::text[]
      WHERE ym = ${ymToDate(ym)}::date AND headcount IS NULL
      RETURNING headcount
    `);
    if (updated.rows[0]) {
      await this.audit.appendWithin(tx, {
        actor: 'system',
        action: 'period.headcount_recorded',
        objectType: 'period',
        objectId: ym,
        detail: { before: null, after: subs.length },
      });
      return subs.length;
    }
    const persisted = await this.findSnapshot(ym, tx);
    return persisted?.headcount ?? subs.length;
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
