import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { auditLogTable } from './audit.schema';

export interface AuditEntry {
  // `sub` hoặc 'system'
  actor: string;
  action: string;
  objectType?: string;
  objectId?: string;
  detail?: Record<string, unknown>;
  // Giờ nghiệp vụ (ClockService) cho audit mà luật kỳ đọc lại; vắng → now() của DB
  at?: Date;
}

@Injectable()
export class AuditWriterService {
  private readonly logger = new Logger(AuditWriterService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async append(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditLogTable).values(toRow(entry));
    } catch (error) {
      // Ghi audit lỗi không được làm gãy luồng auth — log để giám sát
      this.logger.error(
        `Ghi audit thất bại (${entry.action}): ${(error as Error).message}`,
      );
    }
  }

  // Trong transaction nghiệp vụ: lỗi ném ra để rollback cả mutation — đổi được mà mất vết tệ hơn đổi thất bại
  async appendWithin(
    tx: Pick<Database, 'insert'>,
    entry: AuditEntry,
  ): Promise<string> {
    const [row] = await tx
      .insert(auditLogTable)
      .values(toRow(entry))
      .returning({ id: auditLogTable.id });
    return row.id;
  }
}

function toRow(entry: AuditEntry) {
  return {
    actor: entry.actor,
    action: entry.action,
    objectType: entry.objectType ?? null,
    objectId: entry.objectId ?? null,
    detail: entry.detail ?? null,
    ...(entry.at ? { createdAt: entry.at } : {}),
  };
}
