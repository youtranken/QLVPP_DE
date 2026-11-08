import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { decodeTimestampCursor, encodeCursor } from '../../common/cursor';
import { pgSqlState } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor, Tx } from '../../database/database.module';
import { UsersService } from '../users/users.service';
import type { NotificationTopic } from './notification-events';

export type { NotificationTopic };

export interface NotifyInput {
  eventId: string;
  recipients: string[];
  topic: NotificationTopic;
  params: Record<string, unknown>;
  link: string | null;
  now: Date;
}

export interface UpsertInput {
  eventId: string;
  userSub: string;
  kind: 'line_adjusted';
  params: Record<string, unknown> & { ym: string };
  now: Date;
}

export interface NotificationView {
  id: string;
  topic: string;
  params: Record<string, unknown>;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListQuery {
  unread?: boolean;
  limit: number;
  cursor?: string;
}

const iso = (column: string) =>
  sql.raw(
    `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  );

interface Row extends NotificationView, Record<string, unknown> {
  cursor_ts: string;
}

const toView = (r: Row): NotificationView => ({
  id: r.id,
  topic: r.topic,
  params: r.params,
  link: r.link,
  created_at: r.created_at,
  read_at: r.read_at,
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly users: UsersService,
  ) {}

  // SAVEPOINT (transaction lồng của drizzle): chuông lỗi không được làm hỏng tx nghiệp vụ
  async notifyWithin(tx: Tx, n: NotifyInput): Promise<number> {
    if (n.recipients.length === 0) return 0;
    try {
      return await tx.transaction(async (sp) => {
        const result = await sp.execute(sql`
          INSERT INTO in_app_notifications (user_sub, event_id, topic, params, link, created_at)
          SELECT DISTINCT s, ${n.eventId}, ${n.topic}, ${JSON.stringify(n.params)}::jsonb,
                 ${n.link}, ${n.now.toISOString()}::timestamptz
          FROM unnest(${sql.param(n.recipients)}::text[]) AS s
          ON CONFLICT (event_id, user_sub) DO NOTHING
        `);
        return result.rowCount ?? 0;
      });
    } catch (error) {
      // Không log params: có thể chứa tên món/ghi chú người dùng
      this.logger.warn({
        msg: 'notification_write_failed',
        event_id: n.eventId,
        topic: n.topic,
        code: pgSqlState(error) ?? null,
      });
      return 0;
    }
  }

  // Chuông gộp: lần sau ghi đè nội dung, đưa lên đầu và thành chưa đọc lại
  async upsertWithin(tx: Tx, n: UpsertInput): Promise<number> {
    try {
      return await tx.transaction(async (sp) => {
        const result = await sp.execute(sql`
          INSERT INTO in_app_notifications (user_sub, event_id, topic, params, link, created_at)
          VALUES (${n.userSub}, ${n.eventId}, ${n.kind}, ${JSON.stringify(n.params)}::jsonb,
                  ${`/history/${n.params.ym}`}, ${n.now.toISOString()}::timestamptz)
          ON CONFLICT (event_id, user_sub) DO UPDATE
          SET params = EXCLUDED.params, created_at = EXCLUDED.created_at, read_at = NULL
        `);
        return result.rowCount ?? 0;
      });
    } catch (error) {
      this.logger.warn({
        msg: 'notification_write_failed',
        event_id: n.eventId,
        topic: n.kind,
        code: pgSqlState(error) ?? null,
      });
      return 0;
    }
  }

  async adminRecipients(ex?: Executor): Promise<string[]> {
    return this.users.activeAdminSubs(ex);
  }

  async list(
    sub: string,
    q: NotificationListQuery,
  ): Promise<{
    items: NotificationView[];
    next_cursor: string | null;
    unread_count: number;
  }> {
    const after = q.cursor ? decodeTimestampCursor(q.cursor) : null;
    const [page, count] = await Promise.all([
      this.db.execute<Row>(sql`
        SELECT n.id, n.topic, n.params, n.link, ${iso('n.created_at')} AS created_at,
               ${iso('n.read_at')} AS read_at, n.created_at::text AS cursor_ts
        FROM in_app_notifications n
        WHERE n.user_sub = ${sub}
          AND (${q.unread !== true} OR n.read_at IS NULL)
          AND (${after === null} OR (n.created_at, n.id) < (${after?.[0] ?? null}::timestamptz, ${after?.[1] ?? null}::uuid))
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ${q.limit + 1}
      `),
      this.db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM in_app_notifications
        WHERE user_sub = ${sub} AND read_at IS NULL
      `),
    ]);
    const rows = page.rows.slice(0, q.limit);
    const last = rows[rows.length - 1];
    return {
      items: rows.map(toView),
      next_cursor:
        page.rows.length > q.limit && last
          ? encodeCursor([last.cursor_ts, last.id])
          : null,
      unread_count: count.rows[0].n,
    };
  }

  async markRead(
    sub: string,
    ids: string[] | undefined,
    now: Date,
  ): Promise<{ updated: number }> {
    const result = await this.db.execute(sql`
      UPDATE in_app_notifications SET read_at = ${now.toISOString()}::timestamptz
      WHERE user_sub = ${sub} AND read_at IS NULL
        AND (${ids === undefined} OR id = ANY(${sql.param(ids ?? [])}::uuid[]))
    `);
    return { updated: result.rowCount ?? 0 };
  }

  async purgeBefore(cutoff: Date): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM in_app_notifications WHERE created_at < ${cutoff.toISOString()}::timestamptz
    `);
    return result.rowCount ?? 0;
  }
}
