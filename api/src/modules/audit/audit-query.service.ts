import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { decodeTimestampCursor, encodeCursor } from '../../common/cursor';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';

export interface AuditQuery {
  actor?: string;
  action?: string;
  // Ngày VN YYYY-MM-DD, cả hai đầu inclusive
  from?: string;
  to?: string;
  // Hành chính thao tác trên phiếu của chính mình (detail.self)
  self?: boolean;
  limit: number;
  cursor?: string;
}

export interface AuditRow {
  id: string;
  actor: string;
  // null cho system/SA — FE tự dịch
  actorName: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  detail: unknown;
  createdAt: string;
}

@Injectable()
export class AuditQueryService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async listAudit(
    q: AuditQuery,
  ): Promise<{ items: AuditRow[]; next_cursor: string | null }> {
    const conds = [
      q.actor ? sql`a.actor = ${q.actor}` : null,
      q.action ? sql`a.action = ${q.action}` : null,
      // ::timestamp bắt buộc: date AT TIME ZONE ngầm đổi sang timestamptz theo UTC → lệch 7 giờ
      q.from
        ? sql`a.created_at >= (${q.from}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`
        : null,
      q.to
        ? sql`a.created_at < ((${q.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`
        : null,
      q.self === undefined ? null : selfCondition(q.self),
      q.cursor ? this.afterCursor(q.cursor) : null,
    ].filter((c): c is NonNullable<typeof c> => c !== null);
    const where =
      conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;

    // cursor_ts dạng text giữ đủ micro giây; Date của JS cắt về mili giây làm keyset trượt dòng
    const result = await this.db.execute<{
      id: string;
      actor: string;
      actor_name: string | null;
      action: string;
      object_type: string | null;
      object_id: string | null;
      detail: unknown;
      created_at: string;
      cursor_ts: string;
    }>(sql`
      SELECT a.id, a.actor, u.full_name AS actor_name, a.action,
             a.object_type, a.object_id, a.detail, a.created_at,
             a.created_at::text AS cursor_ts
      FROM audit_log a
      LEFT JOIN users u ON u.sub = a.actor
      ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${q.limit + 1}
    `);
    const rows = result.rows.slice(0, q.limit);
    const last = rows[rows.length - 1];
    return {
      items: rows.map((r) => ({
        id: r.id,
        actor: r.actor,
        actorName: r.actor_name,
        action: r.action,
        objectType: r.object_type,
        objectId: r.object_id,
        detail: r.detail,
        createdAt: new Date(r.created_at).toISOString(),
      })),
      next_cursor:
        result.rows.length > q.limit && last
          ? encodeCursor([last.cursor_ts, last.id])
          : null,
    };
  }

  private afterCursor(raw: string) {
    const [ts, id] = decodeTimestampCursor(raw);
    return sql`(a.created_at, a.id) < (${ts}::timestamptz, ${id}::uuid)`;
  }
}

// Dòng không có cờ self tính là không phải self
function selfCondition(self: boolean) {
  return self
    ? sql`(a.detail->>'self') = 'true'`
    : sql`(a.detail->>'self') IS DISTINCT FROM 'true'`;
}
