import { readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { isNotNull } from 'drizzle-orm';
import { parseEnv, type AppConfig } from '../../infra/config/env';
import { DB, type Db } from '../../infra/db/db.module';
import { items, requestItems } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { selectOrphans, type StoredFile } from './orphan-selector';

export interface CleanupResult {
  scanned: number;
  removed: number;
  keptInGrace: number;
  /** Số file xoá hụt (quyền, file đang mở…) — báo để còn biết mà xử lý. */
  failed: number;
}

/**
 * Dọn ảnh không còn ai tham chiếu trên đĩa.
 *
 * Ảnh trở thành mồ côi khi admin đổi/gỡ ảnh của món, hoặc khi người dùng tải ảnh
 * cho mục "Khác" rồi bỏ dở không gửi đơn. Không dọn thì thư mục phình mãi.
 */
@Injectable()
export class UploadsCleanupService {
  private readonly logger = new Logger(UploadsCleanupService.name);
  private readonly config: AppConfig = parseEnv();
  private readonly uploadDir = resolve(parseEnv().UPLOAD_DIR);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async cleanup(actor: { id: string; name: string | null } | null = null): Promise<CleanupResult> {
    if (!this.config.UPLOAD_CLEANUP_ENABLED) {
      this.logger.log('UPLOAD_CLEANUP_ENABLED=false ⇒ bỏ qua dọn ảnh mồ côi.');
      return { scanned: 0, removed: 0, keptInGrace: 0, failed: 0 };
    }

    const graceMs = this.config.UPLOAD_ORPHAN_GRACE_HOURS * 60 * 60 * 1000;
    const files = await this.listFiles();
    const referencedPaths = await this.listReferencedPaths();
    const { remove, keptInGrace } = selectOrphans({
      files,
      referencedPaths,
      now: Date.now(),
      graceMs,
    });

    let removed = 0;
    let failed = 0;
    for (const name of remove) {
      try {
        await unlink(join(this.uploadDir, name));
        removed += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(`Không xoá được ${name}: ${(error as Error).message}`);
      }
    }

    const result: CleanupResult = { scanned: files.length, removed, keptInGrace, failed };

    // Chỉ ghi audit khi thật sự có xoá — chạy hằng ngày mà lần nào cũng ghi thì
    // nhật ký ngập những dòng "đã xoá 0 file".
    if (removed > 0 || failed > 0) {
      await this.audit.log({
        actor,
        action: 'uploads.cleanup',
        objectType: 'uploads',
        detail: result,
      });
    }
    this.logger.log(
      `Dọn ảnh: quét ${result.scanned}, xoá ${result.removed}, giữ trong ân hạn ${result.keptInGrace}` +
        (result.failed > 0 ? `, LỖI ${result.failed}` : ''),
    );
    return result;
  }

  private async listFiles(): Promise<StoredFile[]> {
    let names: string[];
    try {
      names = await readdir(this.uploadDir);
    } catch {
      // Thư mục chưa tồn tại (chưa ai tải ảnh) — không phải lỗi.
      return [];
    }

    const files: StoredFile[] = [];
    for (const name of names) {
      try {
        const info = await stat(join(this.uploadDir, name));
        if (info.isFile()) files.push({ name, modifiedAt: info.mtimeMs });
      } catch {
        // File biến mất giữa chừng — bỏ qua.
      }
    }
    return files;
  }

  /** Mọi đường dẫn ảnh đang được tham chiếu: ảnh món + ảnh đính kèm dòng đơn. */
  private async listReferencedPaths(): Promise<string[]> {
    const [itemImages, attachments] = await Promise.all([
      this.db.select({ path: items.imagePath }).from(items).where(isNotNull(items.imagePath)),
      this.db
        .select({ path: requestItems.attachmentPath })
        .from(requestItems)
        .where(isNotNull(requestItems.attachmentPath)),
    ]);

    return [...itemImages, ...attachments]
      .map((row) => row.path)
      .filter((path): path is string => path !== null);
  }
}
