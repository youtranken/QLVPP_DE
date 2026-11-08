import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { LOCAL_SA_SUB } from '../auth/local-sa-env';
import { CatalogService } from '../catalog/catalog.service';
import { PeriodsService } from '../periods/periods.service';
import { UsersService } from '../users/users.service';
import { UNDELIVERED_LINE } from './line-predicates';
import { lockState } from '../periods/period-lock';
import { invalidPeriod, requestNotFound } from './request-errors';
import { RequestViewBuilder } from './request-view';
import type { RequestView } from './request-view';
import * as repo from './requests.repo';

export interface PeopleCounts {
  registered: number;
  headcount: number;
  unregistered: number;
  outside: number;
  headcount_source: 'snapshot' | 'live';
}

export interface PeriodSummary extends PeopleCounts {
  ym: string;
  deadline: string | null;
  is_open: boolean;
  // Kỳ đang mở: Hành chính chỉ thấy tiến độ đăng ký, không thấy số dòng
  lines_pending_delivery: number | null;
  custom_pending: number | null;
  low_stock: number;
  receipts: number;
  // Kỳ cũ nhất có phiếu: chặn "Tháng trước" ở Kỳ tháng
  earliest_ym: string | null;
}

export interface UnregisteredUser extends Record<string, unknown> {
  sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

// Báo cáo đọc-only: đọc thẳng users/requests/request_lines cho tổng hợp, không ghi
@Injectable()
export class SummaryService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly catalog: CatalogService,
    private readonly users: UsersService,
    private readonly views: RequestViewBuilder,
  ) {}

  // Tiến độ đăng ký xem được cả kỳ mở; chỉ chặn kỳ sau kỳ đang mở
  async assertViewable(ym: string): Promise<{ isOpen: boolean }> {
    const open = await this.periods.openPeriod(this.db, this.clock.now());
    const state = lockState(ym, open.ym);
    if (state === 'future') throw invalidPeriod();
    return { isOpen: state === 'open' };
  }

  async summary(ym: string): Promise<PeriodSummary> {
    const { isOpen } = await this.assertViewable(ym);
    const [period, people, lines, lowStock, receipts, earliest] =
      await Promise.all([
        this.periods.findSnapshot(ym),
        this.people(ym),
        isOpen ? null : this.lineCounts(ym),
        this.catalog.countLowStock(),
        this.receiptCount(ym),
        this.earliestYm(),
      ]);
    return {
      ym,
      deadline: period ? period.deadline.toISOString() : null,
      is_open: isOpen,
      ...people,
      lines_pending_delivery: lines?.lines_pending_delivery ?? null,
      custom_pending: lines?.custom_pending ?? null,
      low_stock: lowStock,
      receipts,
      earliest_ym: earliest,
    };
  }

  private async earliestYm(): Promise<string | null> {
    const { rows } = await this.db.execute<{ ym: string | null }>(sql`
      SELECT to_char(min(period_ym), 'YYYY-MM') AS ym FROM requests
    `);
    return rows[0].ym;
  }

  // Số phiếu Hàng về của kỳ: audit stock.receipt có object_id = ym (chính xác, không suy từ note)
  private async receiptCount(ym: string): Promise<number> {
    const { rows } = await this.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM audit_log
      WHERE action = 'stock.receipt' AND object_id = ${ym}
    `);
    return rows[0].n;
  }

  // registered_subs cùng tập S: trang Nhân viên ghi Đã đăng ký/Chưa mà người ngoài S không thành "Đã đăng ký"
  async unregistered(
    ym: string,
  ): Promise<{ items: UnregisteredUser[]; registered_subs: string[] }> {
    await this.assertViewable(ym);
    const [items, registered] = await Promise.all([
      this.unregisteredRows(ym),
      this.registeredSubs(ym),
    ]);
    return { items, registered_subs: registered };
  }

  // Người nhận nhắc: cùng tập với danh sách chưa đăng ký, không kiểm kỳ theo đồng hồ (cron truyền now riêng)
  async unregisteredSubs(ym: string): Promise<string[]> {
    return (await this.unregisteredRows(ym)).map((u) => u.sub);
  }

  // "Mọi người" của chuông kỳ mở = mẫu số Tổng hợp
  async audienceSubs(): Promise<string[]> {
    const { rows } = await this.db.execute<{ sub: string }>(sql`
      SELECT u.sub FROM users u WHERE ${HEADCOUNT_CONDITION} ORDER BY u.sub
    `);
    return rows.map((r) => r.sub);
  }

  async request(id: string): Promise<RequestView & { user_status: string }> {
    const head = await repo.findRequest(this.db, { id });
    if (!head) throw requestNotFound('Không tìm thấy phiếu.');
    await this.periods.assertLocked(head.period_ym, this.clock.now());
    const view = await this.views.build(this.db, id, false);
    if (!view) throw requestNotFound('Không tìm thấy phiếu.');
    const owner = await this.users.findBySub(view.user_sub);
    return { ...view, user_status: owner?.status ?? 'unknown' };
  }

  async lineCounts(ym: string) {
    const { rows } = await this.db.execute<{
      lines_pending_delivery: number;
      custom_pending: number;
    }>(sql`
      SELECT count(l.id) FILTER (WHERE ${UNDELIVERED_LINE})::int AS lines_pending_delivery,
             count(l.id) FILTER (WHERE l.review_status = 'pending')::int AS custom_pending
      FROM requests r JOIN request_lines l ON l.request_id = r.id
      WHERE r.period_ym = ${ymToDate(ym)}::date
    `);
    return rows[0];
  }

  // Một tập người S: chụp lúc khóa (headcount_subs) hoặc tập sống; mọi số đếm từ S để registered + unregistered = headcount
  async people(ym: string): Promise<PeopleCounts> {
    const s = await this.peopleSet(ym);
    const { rows } = await this.db.execute<
      Omit<PeopleCounts, 'headcount_source'>
    >(sql`
      WITH ${s.cte}
      SELECT (SELECT count(*) FROM s)::int AS headcount,
             (SELECT count(*) FROM s WHERE sub IN (SELECT sub FROM owners))::int AS registered,
             (SELECT count(*) FROM s WHERE sub NOT IN (SELECT sub FROM owners))::int AS unregistered,
             (SELECT count(*) FROM owners WHERE sub NOT IN (SELECT sub FROM s))::int AS outside
    `);
    return { ...rows[0], headcount_source: s.source };
  }

  // Tập sống: người đủ điều kiện ∪ chủ phiếu của kỳ, trừ SA cục bộ — cron ghi tập này lúc khóa
  async liveSubs(ym: string): Promise<string[]> {
    const { rows } = await this.db.execute<{ sub: string }>(sql`
      WITH ${this.liveCte(ym)} SELECT sub FROM s ORDER BY sub
    `);
    return rows.map((r) => r.sub);
  }

  private async registeredSubs(ym: string): Promise<string[]> {
    const s = await this.peopleSet(ym);
    const { rows } = await this.db.execute<{ sub: string }>(sql`
      WITH ${s.cte}
      SELECT sub FROM s WHERE sub IN (SELECT sub FROM owners) ORDER BY sub
    `);
    return rows.map((r) => r.sub);
  }

  private async unregisteredRows(ym: string): Promise<UnregisteredUser[]> {
    const s = await this.peopleSet(ym);
    const { rows } = await this.db.execute<UnregisteredUser>(sql`
      WITH ${s.cte}
      SELECT s.sub, u.full_name, u.email, u.department
      FROM s LEFT JOIN users u ON u.sub = s.sub
      WHERE s.sub NOT IN (SELECT sub FROM owners)
      ORDER BY u.department NULLS LAST, u.full_name, s.sub
    `);
    return rows;
  }

  // Kỳ khóa trước 0116 chỉ có số headcount, không có danh sách: dùng tập sống (R-D8.17) để giữ bất biến
  // registered + unregistered = headcount; số đóng băng cũ không tách được ai đã/chưa đăng ký
  private async peopleSet(
    ym: string,
  ): Promise<{ cte: SQL; source: 'snapshot' | 'live' }> {
    const subs = (await this.periods.findSnapshot(ym))?.headcount_subs ?? null;
    if (subs === null) return { cte: this.liveCte(ym), source: 'live' };
    return {
      cte: sql`${ownersCte(ym)}, s AS (SELECT DISTINCT unnest(${sql.param(subs)}::text[]) AS sub)`,
      source: 'snapshot',
    };
  }

  private liveCte(ym: string): SQL {
    return sql`${ownersCte(ym)}, s AS (
      SELECT u.sub FROM users u WHERE ${HEADCOUNT_CONDITION}
      UNION SELECT sub FROM owners)`;
  }
}

// Mẫu số sống: người active, không phải SA cục bộ, không phải Hành chính (PMH ID đã gác cửa vào VPP)
const HEADCOUNT_CONDITION: SQL = sql`u.status = 'active' AND u.sub <> ${LOCAL_SA_SUB} AND u.role <> 'admin'`;

// Chủ phiếu của kỳ trừ SA cục bộ (không thuộc danh bạ, không bao giờ vào S)
const ownersCte = (ym: string) => sql`owners AS (
  SELECT DISTINCT r.user_sub AS sub FROM requests r
  WHERE r.period_ym = ${ymToDate(ym)}::date AND r.user_sub <> ${LOCAL_SA_SUB})`;
