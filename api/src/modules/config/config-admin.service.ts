import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { configTable } from './config.schema';
import { SystemConfigService } from './system-config.service';

const EDITABLE_KEYS = [
  'registration_last_day',
  'default_max_qty',
  'admin_group',
  'low_stock_notify',
  'signers',
  'admin_contact',
] as const;

// authorized_groups chỉ đọc: directory-sync ghi
const VISIBLE_KEYS = [...EDITABLE_KEYS, 'authorized_groups'];

export type ConfigPatch = Partial<
  Record<(typeof EDITABLE_KEYS)[number], unknown>
>;

const INVALID = (message: string) =>
  new BadRequestException({ code: 'CONFIG_INVALID', message });

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
    patch: ConfigPatch,
    actorSub: string,
  ): Promise<Record<string, unknown>> {
    const entries = Object.entries(patch).filter(
      ([k, v]) =>
        (EDITABLE_KEYS as readonly string[]).includes(k) && v !== undefined,
    );
    if (entries.length === 0) {
      throw INVALID('Không có tham số hợp lệ để cập nhật.');
    }
    await this.db.transaction(async (tx) => {
      for (const [key, value] of entries) {
        const old = await tx
          .select({ value: configTable.value })
          .from(configTable)
          .where(inArray(configTable.key, [key]));
        await tx
          .update(configTable)
          .set({ value, updatedAt: new Date() })
          .where(inArray(configTable.key, [key]));
        await this.audit.appendWithin(tx, {
          actor: actorSub,
          action: 'config.update',
          objectType: 'config',
          objectId: key,
          detail: { from: old[0]?.value ?? null, to: value },
        });
      }
    });
    this.config.clearCache();
    return this.listEditable();
  }
}
