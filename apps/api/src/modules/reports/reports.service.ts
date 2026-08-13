import { Inject, Injectable } from '@nestjs/common';
import { periodForDate } from '@vpp/shared';
import { and, asc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../../infra/db/db.module';
import { departments, requestItems, requests, users } from '../../infra/db/schema';

/** Đơn `rejected`/`cancelled` chỉ còn giá trị lịch sử, không tính vào báo cáo. */
const COUNTED_STATUSES = sql`('submitted','approved','delivered')`;

export interface StatsQuery {
  from?: string;
  to?: string;
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  private periodRange(query: StatsQuery): SQL[] {
    const filters: SQL[] = [sql`${requests.status} in ${COUNTED_STATUSES}`];
    if (query.from) filters.push(gte(requests.period, query.from));
    if (query.to) filters.push(lte(requests.period, query.to));
    return filters;
  }

  /**
   * Thống kê nhiều kỳ cho biểu đồ (REPORT-3).
   * `period` là chuỗi 'YYYY-MM' nên so sánh chuỗi cũng ra đúng thứ tự thời gian.
   */
  async stats(query: StatsQuery) {
    const filters = this.periodRange(query);

    const [byPeriod, byDepartment, [totals]] = await Promise.all([
      this.db
        .select({
          period: requests.period,
          requestCount: sql<number>`count(distinct ${requests.id})::int`,
          itemQty: sql<number>`coalesce(sum(${requestItems.quantity}), 0)::int`,
          deliveredQty: sql<number>`coalesce(sum(${requestItems.deliveredQty}), 0)::int`,
        })
        .from(requests)
        .leftJoin(requestItems, eq(requestItems.requestId, requests.id))
        .where(and(...filters))
        .groupBy(requests.period)
        .orderBy(asc(requests.period)),

      this.db
        .select({
          departmentId: requests.departmentId,
          // Đơn của admin không có phòng ban ⇒ gom vào nhãn riêng thay vì bỏ sót.
          departmentName: sql<string>`coalesce(${departments.name}, 'Không có phòng ban')`,
          requestCount: sql<number>`count(distinct ${requests.id})::int`,
          itemQty: sql<number>`coalesce(sum(${requestItems.quantity}), 0)::int`,
        })
        .from(requests)
        .leftJoin(departments, eq(departments.id, requests.departmentId))
        .leftJoin(requestItems, eq(requestItems.requestId, requests.id))
        .where(and(...filters))
        .groupBy(requests.departmentId, departments.name)
        .orderBy(sql`2`),

      this.db
        .select({
          requestCount: sql<number>`count(distinct ${requests.id})::int`,
          deliveredRequests: sql<number>`count(distinct ${requests.id}) filter (where ${requests.status} = 'delivered')::int`,
        })
        .from(requests)
        .where(and(...filters)),
    ]);

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      byPeriod,
      byDepartment,
      totals: {
        ...totals,
        /** Tỉ lệ đơn đã giao đủ, 0–1. Không có đơn nào thì trả 0 thay vì NaN. */
        deliveredRatio:
          totals.requestCount > 0 ? totals.deliveredRequests / totals.requestCount : 0,
      },
    };
  }

  /** Tổng hợp theo món của một kỳ — sheet 1 của báo cáo (REPORT-1). */
  async summaryByItem(period: string, departmentId?: string) {
    const filters: SQL[] = [
      eq(requests.period, period),
      sql`${requests.status} in ${COUNTED_STATUSES}`,
    ];
    if (departmentId) filters.push(eq(requests.departmentId, departmentId));

    return this.db
      .select({
        name: requestItems.name,
        unit: requestItems.unit,
        totalQty: sql<number>`sum(${requestItems.quantity})::int`,
        deliveredQty: sql<number>`sum(${requestItems.deliveredQty})::int`,
        requestCount: sql<number>`count(distinct ${requests.id})::int`,
      })
      .from(requestItems)
      .innerJoin(requests, eq(requests.id, requestItems.requestId))
      .where(and(...filters))
      .groupBy(requestItems.name, requestItems.unit)
      .orderBy(asc(requestItems.name));
  }

  /** Chi tiết theo người — sheet 2 của báo cáo. */
  async detailByPerson(period: string, departmentId?: string) {
    const filters: SQL[] = [
      eq(requests.period, period),
      sql`${requests.status} in ${COUNTED_STATUSES}`,
    ];
    if (departmentId) filters.push(eq(requests.departmentId, departmentId));

    return this.db
      .select({
        code: requests.code,
        status: requests.status,
        userName: users.name,
        userEmail: users.email,
        departmentName: sql<string>`coalesce(${departments.name}, '')`,
        itemName: requestItems.name,
        unit: requestItems.unit,
        quantity: requestItems.quantity,
        deliveredQty: requestItems.deliveredQty,
        note: requestItems.note,
      })
      .from(requestItems)
      .innerJoin(requests, eq(requests.id, requestItems.requestId))
      .innerJoin(users, eq(users.id, requests.userId))
      .leftJoin(departments, eq(departments.id, requests.departmentId))
      .where(and(...filters))
      .orderBy(sql`coalesce(${departments.name}, '')`, asc(users.name), asc(requestItems.name));
  }

  resolvePeriod(period?: string): string {
    return period ?? periodForDate();
  }
}
