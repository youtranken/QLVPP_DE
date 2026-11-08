import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { configTable } from './config.schema';

const DIRECTORY_SYNC_LAST_KEY = 'directory_sync_last_at';
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

  async setDirectorySyncLastAt(at: Date): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO config (key, value)
      VALUES (${DIRECTORY_SYNC_LAST_KEY}, to_jsonb(${at.getTime()}::bigint))
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `);
  }
}
