import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { UsersService } from '../users/users.service';
import { SUSPENDED_LINE } from './line-predicates';
import { requestNotFound } from './request-errors';
import { RequestViewBuilder } from './request-view';
import * as repo from './requests.repo';
import { SummaryService } from './summary.service';
import { withAdjustments, type MemberRequestView } from './member-adjustments';

export type RegistrationRow = {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  team: string | null;
  line_count: number;
  total_qty: number;
  custom_count: number;
  saved_at: string;
};

type RegistrationDbRow = Omit<RegistrationRow, 'saved_at'> & {
  saved_at: Date | string;
};

// Tổng hợp kỳ mở chỉ xem: đọc-only, không ghi gì, không audit
@Injectable()
export class RegistrationsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly summary: SummaryService,
    private readonly views: RequestViewBuilder,
    private readonly users: UsersService,
  ) {}

  // Kỳ mở chưa duyệt: dòng ngoài DM đang chờ vẫn là món người ấy đã đăng ký, chỉ loại dòng bị từ chối
  // Không phân trang: một kỳ tối đa vài trăm người (cùng lý do với byItem)
  async list(ym: string): Promise<{ items: RegistrationRow[] }> {
    await this.summary.assertViewable(ym);
    const { rows } = await this.db.execute<RegistrationDbRow>(sql`
      SELECT r.id AS request_id, r.user_sub, u.full_name, u.email, u.team,
             count(l.id)::int AS line_count,
             coalesce(sum(l.qty), 0)::int AS total_qty,
             (count(l.id) FILTER (WHERE l.item_id IS NULL))::int AS custom_count,
             r.saved_at
      FROM requests r
      JOIN users u ON u.sub = r.user_sub
      LEFT JOIN request_lines l ON l.request_id = r.id AND l.review_status <> 'rejected'
        AND NOT ${SUSPENDED_LINE}
      WHERE r.period_ym = ${ymToDate(ym)}::date
      GROUP BY r.id, u.sub
      ORDER BY r.saved_at, r.id
    `);
    return {
      items: rows.map((row) => ({
        ...row,
        saved_at: new Date(row.saved_at).toISOString(),
      })),
    };
  }

  async one(
    ym: string,
    id: string,
  ): Promise<MemberRequestView & { team: string | null; user_status: string }> {
    const { isOpen } = await this.summary.assertViewable(ym);
    const head = await repo.findRequest(this.db, { id });
    if (!head || head.period_ym !== ym)
      throw requestNotFound('Không tìm thấy phiếu.');
    const view = await this.views.build(this.db, id, isOpen);
    if (!view) throw requestNotFound('Không tìm thấy phiếu.');
    const owner = await this.users.findBySub(view.user_sub);
    return {
      ...(await withAdjustments(this.db, view)),
      team: owner?.team ?? null,
      user_status: owner?.status ?? 'unknown',
    };
  }
}
