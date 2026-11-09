import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { configTable } from './config.schema';

const DIRECTORY_SYNC_LAST_KEY = 'directory_sync_last_at';
const DIRECTORY_SYNC_TOTAL_KEY = 'directory_sync_last_total';
const DIRECTORY_SYNC_ERROR_KEY = 'directory_sync_last_error';

export interface DirectorySyncError {
  at: Date;
  code: string;
  message: string;
}

export interface DirectorySyncStatus {
  last_at: Date | null;
  last_total: number | null;
  last_error: DirectorySyncError | null;
}
const CACHE_TTL_MS = 30_000;

// Nguồn duy nhất đọc bảng config; module khác inject service này. Tên tránh đụng @nestjs/config.
@Injectable()
export class SystemConfigService {
  private readonly cache = new Map<
    string,
    { value: unknown; expires: number }
  >();

  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  // Gọi sau khi ghi config để hiệu lực ngay thay vì chờ TTL
  clearCache(): void {
    this.cache.clear();
  }

  async get<T>(key: string): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const rows = await this.db
      .select({ value: configTable.value })
      .from(configTable)
      .where(eq(configTable.key, key));
    if (rows.length === 0) {
      throw new Error(
        `Thiếu tham số cấu hình '${key}' — kiểm tra seed migration 0001_config.sql`,
      );
    }
    this.cache.set(key, {
      value: rows[0].value,
      expires: Date.now() + CACHE_TTL_MS,
    });
    return rows[0].value as T;
  }

  // jsonb không đảm bảo kiểu — số hỏng phải nổ rõ tại nguồn đọc
  async getInt(key: string): Promise<number> {
    const raw = await this.get<unknown>(key);
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new Error(
        `Tham số cấu hình '${key}' phải là số nguyên ≥ 0 (đang là ${JSON.stringify(raw)}).`,
      );
    }
    return n;
  }

  async getBool(key: string): Promise<boolean> {
    const raw = await this.get<unknown>(key);
    if (typeof raw !== 'boolean') {
      throw new Error(
        `Tham số cấu hình '${key}' phải là boolean (đang là ${JSON.stringify(raw)}).`,
      );
    }
    return raw;
  }

  // Marker runtime (epoch ms), không phải tham số admin chỉnh; đọc thẳng không cache
  async getDirectorySyncLastAt(): Promise<Date | null> {
    const rows = await this.db
      .select({ value: configTable.value })
      .from(configTable)
      .where(eq(configTable.key, DIRECTORY_SYNC_LAST_KEY));
    if (rows.length === 0) return null;
    return new Date(Number(rows[0].value));
  }

  // Lượt thành công: mốc (chỉ ghi khi thành công) + số người, xóa lỗi gần nhất — một transaction
  async recordDirectorySyncSuccess(at: Date, total: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO config (key, value)
        VALUES (${DIRECTORY_SYNC_LAST_KEY}, to_jsonb(${at.getTime()}::bigint)),
               (${DIRECTORY_SYNC_TOTAL_KEY}, to_jsonb(${total}::int))
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `);
      await tx.execute(
        sql`DELETE FROM config WHERE key = ${DIRECTORY_SYNC_ERROR_KEY}`,
      );
    });
  }

  // Lượt lỗi: chỉ lỗi gần nhất, không đụng mốc thành công (trang Người dùng hiện "đang hiện bản …")
  async recordDirectorySyncError(e: DirectorySyncError): Promise<void> {
    const value = JSON.stringify({
      at: e.at.getTime(),
      code: e.code,
      message: e.message,
    });
    await this.db.execute(sql`
      INSERT INTO config (key, value)
      VALUES (${DIRECTORY_SYNC_ERROR_KEY}, ${value}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
  }

  // Đọc thẳng, không cache; giá trị hỏng coi như không có (chỉ để hiển thị)
  async getDirectorySyncStatus(): Promise<DirectorySyncStatus> {
    const rows = await this.db
      .select({ key: configTable.key, value: configTable.value })
      .from(configTable)
      .where(
        inArray(configTable.key, [
          DIRECTORY_SYNC_LAST_KEY,
          DIRECTORY_SYNC_TOTAL_KEY,
          DIRECTORY_SYNC_ERROR_KEY,
        ]),
      );
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      last_at: toDate(byKey.get(DIRECTORY_SYNC_LAST_KEY)),
      last_total: toCount(byKey.get(DIRECTORY_SYNC_TOTAL_KEY)),
      last_error: toSyncError(byKey.get(DIRECTORY_SYNC_ERROR_KEY)),
    };
  }
}

function toDate(v: unknown): Date | null {
  if (v === undefined || v === null) return null;
  const d = new Date(Number(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toCount(v: unknown): number | null {
  const n = Number(v);
  return v !== undefined && v !== null && Number.isInteger(n) && n >= 0
    ? n
    : null;
}

function toSyncError(v: unknown): DirectorySyncError | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as { at?: unknown; code?: unknown; message?: unknown };
  const at = toDate(o.at);
  if (!at || typeof o.code !== 'string') return null;
  return {
    at,
    code: o.code,
    message: typeof o.message === 'string' ? o.message : '',
  };
}
