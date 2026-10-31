import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { configTable } from './config.schema';
import { reminderConflict, validateConfigPatch } from './config-validation';
import type { ConfigPatch, ReminderWindow } from './config-validation';
import { SystemConfigService } from './system-config.service';

const VISIBLE_KEYS = [
  'registration_last_day',
  'reminder_days_left',
  'default_max_qty',
  'admin_group',
  'authorized_groups',
  'low_stock_notify',
  'signature_boxes',
  'admin_contact',
];
const REMINDER_KEYS = ['registration_last_day', 'reminder_days_left'];

const invalid = (field: string) =>
  new BadRequestException({
    code: 'CONFIG_INVALID',
    message: `Giá trị cấu hình không hợp lệ: ${field}.`,
    field,
  });

// Thiếu khóa (DB chưa seed) thì dùng giá trị seed của 0001/0112
function reminderWindowOf(current: Record<string, unknown>): ReminderWindow {
  const num = (v: unknown, seed: number) => (typeof v === 'number' ? v : seed);
  return {
    registration_last_day: num(current.registration_last_day, 10),
    reminder_days_left: num(current.reminder_days_left, 3),
  };
}

@Injectable()
export class ConfigAdminService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
    private readonly config: SystemConfigService,
  ) {}

  async listEditable(): Promise<Record<string, unknown>> {
    const rows = await this.db
      .select({ key: configTable.key, value: configTable.value })
      .from(configTable)
      .where(inArray(configTable.key, VISIBLE_KEYS));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async update(
    body: unknown,
    actorSub: string,
  ): Promise<Record<string, unknown>> {
    const result = validateConfigPatch(body);
    if (!result.ok) throw invalid(result.field);
    const patch = result.patch;
    const keys = Object.keys(patch).sort();
    // Khóa cả cặp hạn/ngày nhắc để luật chéo không bị hai PUT đồng thời lách
    const lockKeys = keys.some((k) => REMINDER_KEYS.includes(k))
      ? [...new Set([...keys, ...REMINDER_KEYS])].sort()
      : keys;
    await this.db.transaction(async (tx) => {
      const locked = await tx.execute<{ key: string; value: unknown }>(sql`
        SELECT key, value FROM config WHERE key IN ${lockKeys} ORDER BY key FOR UPDATE
      `);
      const current: Record<string, unknown> = Object.fromEntries(
        locked.rows.map((r) => [r.key, r.value]),
      );
      const conflict = reminderConflict(patch, reminderWindowOf(current));
      if (conflict) throw invalid(conflict);
      const before = Object.fromEntries(keys.map((k) => [k, current[k]]));
      const after: Record<string, unknown> = {};
      for (const key of keys) {
        after[key] = patch[key as keyof ConfigPatch];
        await tx.execute(sql`
          INSERT INTO config (key, value)
          VALUES (${key}, ${JSON.stringify(after[key])}::jsonb)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `);
      }
      await this.audit.appendWithin(tx, {
        actor: actorSub,
        action: 'config.updated',
        objectType: 'config',
        objectId: keys.join(','),
        detail: { before, after },
      });
    });
    this.config.clearCache();
    return this.listEditable();
  }
}
