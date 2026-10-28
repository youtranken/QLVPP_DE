import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { configTable } from './config.schema';
import { validateConfigPatch } from './config-validation';
import { SystemConfigService } from './system-config.service';

const VISIBLE_KEYS = [
  'registration_last_day',
  'default_max_qty',
  'admin_group',
  'authorized_groups',
  'low_stock_notify',
  'signers',
  'admin_contact',
];

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
    if (!result.ok) {
      throw new BadRequestException({
        code: 'CONFIG_INVALID',
        message: `Giá trị cấu hình không hợp lệ: ${result.field}.`,
        field: result.field,
      });
    }
    const keys = Object.keys(result.patch).sort();
    await this.db.transaction(async (tx) => {
      const locked = await tx.execute<{ key: string; value: unknown }>(sql`
        SELECT key, value FROM config WHERE key IN ${keys} ORDER BY key FOR UPDATE
      `);
      const before = Object.fromEntries(
        locked.rows.map((r) => [r.key, r.value]),
      );
      const after: Record<string, unknown> = {};
      for (const key of keys) {
        const incoming = result.patch[key as keyof typeof result.patch];
        // signers merge theo người ký: sửa một người không xóa hai người còn lại
        after[key] =
          key === 'signers'
            ? { ...(before.signers as object), ...(incoming as object) }
            : incoming;
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
