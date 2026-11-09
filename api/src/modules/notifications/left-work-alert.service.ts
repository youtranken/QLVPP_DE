import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { MailOutbox } from '../mail/mail-outbox';
import { PeriodsService } from '../periods/periods.service';
import { UNDELIVERED_LINE, lockedPeriod } from '../requests/line-predicates';
import { UserAccessService } from '../users/user-access.service';
import type { LostStatus } from '../users/user-access.service';
import { eventIds } from './notification-events';
import { leftWorkLink, leftWorkMail } from './left-work-message';
import type { LeftWorkParams } from './left-work-message';
import { NotificationsService } from './notifications.service';

const ACTOR = 'system';

interface Work extends Record<string, unknown> {
  owed_lines: number;
  owed_months: number;
  pending_lines: number;
  open_request: boolean;
}

// Việc dở (quyết định 1): dòng còn tính mà chưa giao hết ở kỳ đã khoá + món ngoài danh mục chờ duyệt.
// Phiếu kỳ đang mở chỉ nhắc trong nội dung.
async function pendingWork(tx: Tx, sub: string, openYm: string): Promise<Work> {
  const owed = sql`(${lockedPeriod(openYm)} AND ${UNDELIVERED_LINE})`;
  const { rows } = await tx.execute<Work>(sql`
    SELECT count(*) FILTER (WHERE ${owed})::int AS owed_lines,
           count(DISTINCT r.period_ym) FILTER (WHERE ${owed})::int AS owed_months,
           count(*) FILTER (WHERE l.review_status = 'pending')::int AS pending_lines,
           coalesce(bool_or(r.period_ym = ${ymToDate(openYm)}::date
                            AND l.review_status <> 'rejected'), false) AS open_request
    FROM requests r
    JOIN request_lines l ON l.request_id = r.id
    WHERE r.user_sub = ${sub}
  `);
  return rows[0];
}

// Mục 6 chuẩn PMH ID: người rời active còn giữ việc → chuông cho mọi Hành chính active + email;
// không còn việc → chỉ nhật ký. event_id gắn mốc rời active → một lần mỗi lần mất quyền.
@Injectable()
export class LeftWorkAlertService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly access: UserAccessService,
    private readonly notifications: NotificationsService,
    private readonly periods: PeriodsService,
    private readonly audit: AuditWriterService,
    private readonly clock: ClockService,
    private readonly mail: MailOutbox,
  ) {}

  onModuleInit(): void {
    this.access.onAccessLost((sub, status) => this.handle(sub, status));
  }

  async handle(sub: string, status: LostStatus): Promise<void> {
    const now = this.clock.now();
    const created = await this.db.transaction(async (tx) => {
      const { rows } = await tx.execute<{
        name: string;
        status: string;
        inactive_ms: string | null;
      }>(sql`
        SELECT coalesce(nullif(trim(full_name), ''), nullif(trim(email), ''), sub) AS name,
               status,
               floor(extract(epoch FROM inactive_at) * 1000)::bigint::text AS inactive_ms
        FROM users WHERE sub = ${sub}
      `);
      const user = rows[0];
      // Đã được mở lại trước khi tới đây → không còn là người rời đi
      if (!user || user.status === 'active' || !user.inactive_ms) return null;
      const { ym: openYm } = await this.periods.openPeriod(tx, now);
      const work = await pendingWork(tx, sub, openYm);
      const params: LeftWorkParams = {
        name: user.name,
        reason: status,
        owed_lines: work.owed_lines,
        owed_months: work.owed_months,
        pending_lines: work.pending_lines,
        open_request: work.open_request,
      };
      if (work.owed_lines + work.pending_lines === 0) {
        await this.audit.appendWithin(tx, {
          actor: ACTOR,
          action: 'users.left_no_work',
          objectType: 'user',
          objectId: sub,
          detail: { reason: status, open_request: work.open_request },
        });
        return null;
      }
      const admins = await this.notifications.adminRecipients(tx);
      const link = leftWorkLink(sub, params);
      const inserted = await this.notifications.notifyWithin(tx, {
        eventId: eventIds.leftWork(sub, user.inactive_ms),
        recipients: admins,
        topic: 'user_left_with_work',
        params: { ...params },
        link,
        now,
      });
      if (inserted === 0) return null;
      await this.audit.appendWithin(tx, {
        actor: ACTOR,
        action: 'users.left_with_work',
        objectType: 'user',
        objectId: sub,
        detail: {
          reason: status,
          owed_lines: work.owed_lines,
          pending_lines: work.pending_lines,
          open_request: work.open_request,
          notified: inserted,
        },
      });
      const emails = await tx.execute<{ email: string }>(sql`
        SELECT DISTINCT email FROM users
        WHERE sub = ANY(${sql.param(admins)}::text[]) AND nullif(trim(email), '') IS NOT NULL
        ORDER BY email
      `);
      return { params, link, to: emails.rows.map((r) => r.email) };
    });
    // Sau commit, không chờ: lỗi gửi chỉ log trong MailOutbox
    if (created) {
      this.mail.enqueue({
        to: created.to,
        ...leftWorkMail(
          created.params,
          created.link,
          process.env.APP_BASE_URL ?? '',
        ),
      });
    }
  }
}
