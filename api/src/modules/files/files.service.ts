import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { isUuid } from '../../common/uuid';
import { FILE_PURPOSES, extensionFor, sniff } from './file-validation';
import type { FilePurpose, ImageMime } from './file-validation';

export interface UploadedFile {
  id: string;
  mime: ImageMime;
  size_bytes: number;
}

export function filesDir(): string {
  return process.env.FILES_DIR || '/data/files';
}

export function storedPath(id: string, mime: string): string {
  return join(filesDir(), `${id}.${extensionFor(mime as ImageMime)}`);
}

@Injectable()
export class FilesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    purpose: unknown,
    actorSub: string,
  ): Promise<UploadedFile> {
    if (!FILE_PURPOSES.includes(purpose as FilePurpose)) {
      throw new BadRequestException({
        code: 'PURPOSE_INVALID',
        message: `purpose phải là một trong: ${FILE_PURPOSES.join(', ')}.`,
      });
    }
    const mime = file ? sniff(file.buffer) : null;
    if (!file || !mime) {
      throw new BadRequestException({
        code: 'FILE_TYPE_INVALID',
        message: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.',
      });
    }
    const id = randomUUID();
    const path = storedPath(id, mime);
    await writeFile(path, file.buffer, { flag: 'wx' });
    try {
      await this.db.transaction(async (tx) => {
        await tx.execute(sql`
          INSERT INTO files (id, original_name, mime, size_bytes, purpose, uploaded_by_sub)
          VALUES (${id}, ${file.originalname}, ${mime}, ${file.size}, ${purpose}, ${actorSub})
        `);
        await this.audit.appendWithin(tx, {
          actor: actorSub,
          action: 'files.uploaded',
          objectType: 'file',
          objectId: id,
          detail: { purpose, mime, size_bytes: file.size },
        });
      });
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
    return { id, mime, size_bytes: file.size };
  }

  // Member chỉ gắn được tệp chính mình tải với đúng mục đích; không lộ tệp có tồn tại hay không
  async assertOwnedBy(
    fileId: string,
    sub: string,
    purpose: FilePurpose,
  ): Promise<void> {
    const owned =
      isUuid(fileId) &&
      (
        await this.db.execute(sql`
          SELECT 1 FROM files
          WHERE id = ${fileId} AND uploaded_by_sub = ${sub} AND purpose = ${purpose}
        `)
      ).rows.length > 0;
    if (!owned) {
      throw new ForbiddenException({
        code: 'FILE_FORBIDDEN',
        message: 'Không dùng được tệp này.',
      });
    }
  }
}
