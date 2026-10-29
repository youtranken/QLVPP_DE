import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { LOCAL_SA_SUB } from '../auth/local-sa-env';
import { CatalogService } from '../catalog/catalog.service';
import { SystemConfigService } from '../config/system-config.service';
import { PeriodsService } from '../periods/periods.service';
import { UsersService } from '../users/users.service';
import { UNDELIVERED_LINE } from './line-predicates';
import { invalidPeriod, requestNotFound } from './request-errors';
import { RequestViewBuilder } from './request-view';
import type { RequestView } from './request-view';
import * as repo from './requests.repo';

export interface PeriodSummary {
  ym: string;
  deadline: string | null;
  is_open: boolean;
  registered: number;
  headcount: number;
  headcount_source: 'snapshot' | 'live';
  unregistered: number;
  lines_pending_delivery: number;
  custom_pending: number;
  low_stock: number;
}

export interface UnregisteredUser extends Record<string, unknown> {
  sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

const notRegistered = (ym: string) => sql`NOT EXISTS (
  SELECT 1 FROM requests r
  WHERE r.user_sub = u.sub AND r.period_ym = ${ymToDate(ym)}::date)`;

// Báo cáo đọc-only: đọc thẳng users/requests/request_lines cho tổng hợp, không ghi
@Injectable()
export class SummaryService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly config: SystemConfigService,
    private readonly catalog: CatalogService,
    private readonly users: UsersService,
    private readonly views: RequestViewBuilder,
  ) {}

  // Kỳ quá khứ không cần có dòng periods; chỉ chặn kỳ sau kỳ đang mở
  async assertViewable(ym: string): Promise<{ isOpen: boolean }> {
    const open = await this.periods.openPeriod(this.db, this.clock.now());
    if (ym > open.ym) throw invalidPeriod();
    return { isOpen: ym === open.ym };
  }

  async summary(ym: string): Promise<PeriodSummary> {
    const { isOpen } = await this.assertViewable(ym);
    const [period, counts, live, lowStock] = await Promise.all([
      this.periods.findSnapshot(ym),
      this.requestCounts(ym),
      this.liveCounts(ym),
      this.catalog.countLowStock(),
    ]);
    const snapshot = period?.headcount ?? null;
    return {
      ym,
      deadline: period ? period.deadline.toISOString() : null,
      is_open: isOpen,
      ...counts,
      headcount: snapshot ?? live.headcount,
      headcount_source: snapshot === null ? 'live' : 'snapshot',
      unregistered: live.unregistered,
      low_stock: lowStock,
    };
  }

  async unregistered(ym: string): Promise<{ items: UnregisteredUser[] }> {
    await this.assertViewable(ym);
    return { items: await this.unregisteredRows(ym) };
  }

  // Người nhận nhắc: cùng tập với danh sách chưa đăng ký, không kiểm kỳ theo đồng hồ (cron truyền now riêng)
  async unregisteredSubs(ym: string): Promise<string[]> {
    return (await this.unregisteredRows(ym)).map((u) => u.sub);
  }

  // "Mọi người" của chuông kỳ mở = mẫu số Tổng hợp
  async audienceSubs(): Promise<string[]> {
    const { rows } = await this.db.execute<{ sub: string }>(sql`
      SELECT u.sub FROM users u WHERE ${await this.headcountCondition()} ORDER BY u.sub
    `);
    return rows.map((r) => r.sub);
  }

  async request(id: string): Promise<RequestView & { user_status: string }> {
    const open = await this.periods.openPeriod(this.db, this.clock.now());
    const head = await repo.findRequest(this.db, { id });
    const view =
      head && (await this.views.build(this.db, id, head.period_ym === open.ym));
    if (!view) throw requestNotFound('Không tìm thấy phiếu.');
    const owner = await this.users.findBySub(view.user_sub);
    return { ...view, user_status: owner?.status ?? 'unknown' };
  }

  async requestCounts(ym: string) {
    const { rows } = await this.db.execute<{
      registered: number;
      lines_pending_delivery: number;
      custom_pending: number;
    }>(sql`
      SELECT count(DISTINCT r.id)::int AS registered,
             count(l.id) FILTER (WHERE ${UNDELIVERED_LINE})::int AS lines_pending_delivery,
             count(l.id) FILTER (WHERE l.review_status = 'pending')::int AS custom_pending
      FROM requests r LEFT JOIN request_lines l ON l.request_id = r.id
      WHERE r.period_ym = ${ymToDate(ym)}::date
    `);
    return rows[0];
  }

  // Cùng điều kiện với danh sách unregistered → số luôn bằng độ dài danh sách
  async liveCounts(
    ym: string,
  ): Promise<{ headcount: number; unregistered: number }> {
    const { rows } = await this.db.execute<{
      headcount: number;
      unregistered: number;
    }>(sql`
      SELECT count(*)::int AS headcount,
             count(*) FILTER (WHERE ${notRegistered(ym)})::int AS unregistered
      FROM users u WHERE ${await this.headcountCondition()}
    `);
    return rows[0];
  }

  private async unregisteredRows(ym: string): Promise<UnregisteredUser[]> {
    const { rows } = await this.db.execute<UnregisteredUser>(sql`
      SELECT u.sub, u.full_name, u.email, u.department FROM users u
      WHERE ${await this.headcountCondition()} AND ${notRegistered(ym)}
      ORDER BY u.department NULLS LAST, u.full_name, u.sub
    `);
    return rows;
  }

  // Mẫu số sống: người active, không phải SA cục bộ, thuộc group được cấp (gate rỗng = mọi người)
  private async headcountCondition(): Promise<SQL> {
    const groups = (await this.config.getAuthorizedGroups()).map((g) =>
      g.toLowerCase(),
    );
    return sql`u.status = 'active' AND u.sub <> ${LOCAL_SA_SUB}
      AND (${groups.length === 0} OR (jsonb_typeof(u.groups) = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(u.groups) g
        WHERE lower(g) = ANY(${sql.param(groups)}::text[]))))`;
  }
}
