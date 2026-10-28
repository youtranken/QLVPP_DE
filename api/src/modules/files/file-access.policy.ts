import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { isUuid } from '../../common/uuid';
import type { RequestIdentity } from '../auth/identity.types';
import type { FilePurpose } from './file-validation';

// Điều kiện SQL do module sở hữu bảng tham chiếu cung cấp; alias `f` = dòng files, `$2` = sub người xem.
// Chuỗi hằng trong code, không bao giờ ghép từ input người dùng.
export interface FileReference {
  readonly name: string;
  // Cron chỉ dọn purpose đã có reference đăng ký: module chưa đăng ký thì tệp của nó không bị coi là mồ côi
  readonly purpose: FilePurpose;
  // Đúng khi người xem `$2` được đọc f nhờ tham chiếu này
  readonly readCondition: string;
  // Đúng khi f còn được tham chiếu (bất kể ai) — cron dọn mồ côi giữ lại
  readonly referencedCondition: string;
}

export interface CleanupScope {
  purposes: FilePurpose[];
  referencedSql: string;
}

export interface ReadableFile {
  id: string;
  mime: string;
}

@Injectable()
export class FileAccessPolicy {
  private readonly references: FileReference[] = [];

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  registerReference(reference: FileReference): void {
    if (this.references.some((r) => r.name === reference.name)) {
      throw new Error(`FileReference "${reference.name}" đã đăng ký.`);
    }
    this.references.push(reference);
  }

  async canRead(fileId: string, identity: RequestIdentity): Promise<boolean> {
    return (await this.findReadable(fileId, identity)) !== null;
  }

  // Một truy vấn gộp tồn tại + quyền: không phân biệt "không có" với "không được xem"
  async findReadable(
    fileId: string,
    identity: RequestIdentity,
  ): Promise<ReadableFile | null> {
    if (!isUuid(fileId)) return null;
    const privileged = identity.role === 'admin' || identity.role === 'sa';
    const viaReferences = this.references.map((r) => `(${r.readCondition})`);
    const allowed = ['$3::boolean', 'f.uploaded_by_sub = $2', ...viaReferences];
    const result = await this.pool.query<ReadableFile>(
      `SELECT f.id, f.mime FROM files f
       WHERE f.id = $1 AND (${allowed.join(' OR ')})`,
      [fileId, identity.sub, privileged],
    );
    return result.rows[0] ?? null;
  }

  cleanupScope(): CleanupScope | null {
    if (this.references.length === 0) return null;
    return {
      purposes: [...new Set(this.references.map((r) => r.purpose))],
      referencedSql: this.references
        .map((r) => `(${r.referencedCondition})`)
        .join(' OR '),
    };
  }
}
