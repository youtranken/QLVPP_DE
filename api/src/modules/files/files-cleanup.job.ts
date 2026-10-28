import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { unlink } from 'node:fs/promises';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { FileAccessPolicy } from './file-access.policy';
import { storedPath } from './files.service';

interface DeletedFile extends Record<string, unknown> {
  id: string;
  mime: string;
}

@Injectable()
export class FilesCleanupJob {
  private readonly logger = new Logger(FilesCleanupJob.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
    private readonly policy: FileAccessPolicy,
  ) {}

  @Cron('0 3 * * *', { name: 'files-cleanup', timeZone: 'Asia/Ho_Chi_Minh' })
  async nightly(): Promise<void> {
    try {
      const n = await this.run(new Date());
      if (n > 0) this.logger.log(`dọn ${n} tệp mồ côi`);
    } catch (e) {
      this.logger.error(`dọn tệp mồ côi lỗi: ${(e as Error).message}`);
    }
  }

  // Xóa bản ghi trước, tệp sau: chết giữa chừng chỉ để lại tệp rác, không để bản ghi trỏ vào tệp đã mất
  async run(now: Date): Promise<number> {
    const scope = this.policy.cleanupScope();
    if (!scope) return 0;
    const deleted = await this.db.transaction(async (tx) => {
      const result = await tx.execute<DeletedFile>(sql`
        DELETE FROM files f
        WHERE f.created_at < ${now.toISOString()}::timestamptz - interval '24 hours'
          AND f.purpose IN ${scope.purposes}
          AND NOT (${sql.raw(scope.referencedSql)})
        RETURNING f.id, f.mime
      `);
      if (result.rows.length > 0) {
        await this.audit.appendWithin(tx, {
          actor: 'system',
          action: 'files.orphans_deleted',
          objectType: 'file',
          detail: { ids: result.rows.map((r) => r.id) },
        });
      }
      return result.rows;
    });
    for (const row of deleted) {
      await unlink(storedPath(row.id, row.mime)).catch(
        (e: NodeJS.ErrnoException) => {
          if (e.code !== 'ENOENT') {
            this.logger.error(`không xóa được tệp ${row.id}: ${e.message}`);
          }
        },
      );
    }
    return deleted.length;
  }
}
