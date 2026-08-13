import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../../infra/db/db.module';
import { auditLog } from '../../infra/db/schema';

/** Ai thực hiện hành động. `null` = hệ thống (job đồng bộ, webhook từ PMH ID). */
export interface AuditActor {
  id: string;
  name: string | null;
}

export interface AuditEntry {
  actor: AuditActor | null;
  action: string;
  objectType?: string;
  objectId?: string;
  detail?: unknown;
}

/**
 * Nhật ký audit — giữ VÔ THỜI HẠN (SDD §9), phục vụ đối soát/kiểm toán.
 * Chụp lại `actorName` tại thời điểm thao tác để log vẫn đọc được nếu user bị xoá.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async log(entry: AuditEntry, tx: Db | undefined = undefined): Promise<void> {
    await (tx ?? this.db).insert(auditLog).values({
      actorId: entry.actor?.id ?? null,
      actorName: entry.actor?.name ?? 'Hệ thống',
      action: entry.action,
      objectType: entry.objectType ?? null,
      objectId: entry.objectId ?? null,
      detail: entry.detail ?? null,
    });
  }

  /** Danh sách audit, mới nhất trước, có phân trang (ADMIN-5). */
  async list(options: { action?: string; page: number; pageSize: number }) {
    const filter: SQL | undefined = options.action
      ? eq(auditLog.action, options.action)
      : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(auditLog)
        .where(filter)
        .orderBy(desc(auditLog.createdAt))
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(filter),
    ]);

    return { items: rows, total, page: options.page, pageSize: options.pageSize };
  }
}
