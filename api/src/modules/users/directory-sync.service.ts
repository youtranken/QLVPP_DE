import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { DIRECTORY_CLIENT } from './directory.client';
import type { DirectoryClientApi, DirectoryUser } from './directory.client';
import {
  classify,
  insertNew,
  loadExisting,
  updateChanged,
} from './directory-sync.bulk';
import type { BulkOutcome } from './directory-sync.bulk';
import { DirectoryReconcileService } from './directory-reconcile.service';
import type { ReconcileResult } from './directory-reconcile.service';
import { UserAccessService } from './user-access.service';

export interface DirectorySyncResult extends ReconcileResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  restored: number;
}

// Một transaction; INSERT … ON CONFLICT để 2 sync đồng thời không nổ PK. Người đang no_access mà
// Directory báo active không được mở trong bulk: mở sau commit, có điều kiện mốc bắt đầu sync.
@Injectable()
export class DirectorySyncService {
  private readonly logger = new Logger(DirectorySyncService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(DIRECTORY_CLIENT) private readonly directory: DirectoryClientApi,
    private readonly audit: AuditWriterService,
    private readonly access: UserAccessService,
    private readonly reconcile: DirectoryReconcileService,
  ) {}

  async sync(actor: string): Promise<DirectorySyncResult> {
    // Mốc trước khi liệt kê, theo đồng hồ DB (cùng nguồn với inactive_at): thu hồi sau mốc này
    // thì danh sách có thể đã cũ, không được dùng nó để mở lại người đó
    const syncStartedAt = await this.dbNow();
    this.directory.resetCount();
    const rawUsers = await this.directory.fetchUsers();
    const valid = rawUsers.filter(
      (u) =>
        typeof u.id === 'string' &&
        u.id.length > 0 &&
        !u.id.startsWith('local'),
    );
    const skipped = rawUsers.length - valid.length;
    if (skipped > 0) {
      this.logger.warn(`Directory sync: bỏ qua ${skipped} record thiếu id`);
    }
    const users = [...new Map(valid.map((u) => [u.id, u])).values()];

    const bulk = await this.writeBulk(users);
    for (const c of bulk.roleChanges) {
      await this.audit.append({
        actor: 'system(pmh-id)',
        action: 'users.role_changed',
        objectType: 'user',
        objectId: c.sub,
        detail: { from: c.from, to: c.to, source: 'directory' },
      });
    }
    let restored = 0;
    for (const sub of bulk.reappeared) {
      if (
        await this.access.restoreActive(sub, syncStartedAt, 'directory', actor)
      ) {
        restored += 1;
      }
    }
    // Record hỏng: không chắc ai thật sự vắng → không đánh dấu ai lượt này
    const rec: ReconcileResult =
      skipped > 0
        ? { no_access: 0, unconfirmed: 0, reconcile: 'skipped' }
        : await this.reconcile.run(users, syncStartedAt, actor);

    const result: DirectorySyncResult = {
      total: rawUsers.length,
      created: bulk.created,
      updated: bulk.updated,
      unchanged: bulk.unchanged,
      skipped,
      restored,
      ...rec,
    };
    await this.report(result, bulk.deleted, actor);
    return result;
  }

  private async report(
    result: DirectorySyncResult,
    deleted: string[],
    actor: string,
  ): Promise<void> {
    if (deleted.length > 0) {
      this.logger.warn(
        `Directory sync: phát hiện ${deleted.length} user chuyển deleted: ${deleted.join(', ')}`,
      );
    }
    this.logger.log(
      `Directory sync: ${result.total} user, ${result.created} mới, ${result.updated} cập nhật, ` +
        `${result.unchanged} không đổi, ${result.skipped} bỏ qua, ${result.no_access} mất quyền, ` +
        `${result.restored} được cấp lại, ${result.unconfirmed} chưa xác nhận, đối chiếu ${result.reconcile}`,
    );
    await this.audit.append({
      actor,
      action: 'users.directory_sync',
      objectType: 'users',
      detail: { ...result, deleted_detected: deleted },
    });
  }

  private async writeBulk(users: DirectoryUser[]): Promise<BulkOutcome> {
    try {
      return await this.db.transaction(async (tx) => {
        const existing = await loadExisting(tx, users);
        const plan = classify(users, existing);
        return {
          ...plan.out,
          created: await insertNew(tx, plan.toInsert),
          updated: await updateChanged(tx, plan.toUpdate),
        };
      });
    } catch (error) {
      this.logger.error(
        `Directory sync thất bại (đã rollback): ${(error as Error).message}`,
      );
      throw new InternalServerErrorException({
        code: 'DIRECTORY_SYNC_FAILED',
        message:
          'Đồng bộ thất bại — mọi thay đổi đã được hoàn tác, vui lòng thử lại.',
      });
    }
  }

  private async dbNow(): Promise<Date> {
    const r = await this.db.execute<{ now: Date | string }>(
      sql`SELECT clock_timestamp() AS now`,
    );
    const now = new Date(r.rows[0]?.now ?? Number.NaN);
    if (Number.isNaN(now.getTime())) {
      throw new InternalServerErrorException({
        code: 'DIRECTORY_SYNC_FAILED',
        message: 'Không đọc được giờ của CSDL — thử lại sau.',
      });
    }
    return now;
  }
}
