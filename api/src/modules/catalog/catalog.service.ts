import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { SystemConfigService } from '../config/system-config.service';
import { FilesService } from '../files/files.service';
import type { CreateItemDto, UpdateItemDto } from './catalog.dto';
import {
  ITEM_COLUMNS,
  definedEntries,
  pgViolation,
  pick,
  setClause,
} from './catalog-sql';
import type { ItemRow } from './catalog-sql';
import { ITEM_USAGE_HOOK } from './item-usage.hook';
import type { ItemUsageHook } from './item-usage.hook';

export const itemNotFound = () =>
  new NotFoundException({
    code: 'ITEM_NOT_FOUND',
    message: 'Không tìm thấy món.',
  });

const CONSTRAINT_ERRORS: Record<string, () => Error> = {
  items_category_id_fkey: () =>
    new BadRequestException({
      code: 'CATEGORY_NOT_FOUND',
      message: 'Nhóm món không tồn tại.',
    }),
  items_code_key: () =>
    new ConflictException({
      code: 'ITEM_CODE_EXISTS',
      message: 'Mã món đã được dùng.',
    }),
  stock_movements_item_id_fkey: () => itemInUse(),
  // Ảnh bị job dọn tệp mồ côi xóa giữa lúc kiểm quyền và lúc ghi món
  items_image_file_id_fkey: () =>
    new BadRequestException({
      code: 'IMAGE_REQUIRED',
      message: 'Ảnh không còn — tải ảnh lại.',
    }),
};

function itemInUse() {
  return new ConflictException({
    code: 'ITEM_IN_USE',
    message: 'Món đã có trong phiếu hoặc sổ kho — hãy ngừng món thay vì xóa.',
  });
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
    private readonly files: FilesService,
    private readonly config: SystemConfigService,
    @Inject(ITEM_USAGE_HOOK) private readonly usage: ItemUsageHook,
  ) {}

  // missing_image: món seed chưa có ảnh để admin biết cần bổ sung
  // Id được liệt kê vẫn trả dù ngừng/admin_only: để member xem lại dòng cũ trong phiếu của mình
  async listFor(
    identity: RequestIdentity,
    includeIds: string[] = [],
  ): Promise<(ItemRow & { missing_image: boolean })[]> {
    const privileged = identity.role === 'admin' || identity.role === 'sa';
    const result = await this.db.execute<
      ItemRow & { missing_image: boolean }
    >(sql`
      SELECT ${ITEM_COLUMNS}, (image_file_id IS NULL) AS missing_image FROM items
      WHERE ${privileged}
         OR (active AND NOT admin_only)
         OR id = ANY(${sql.param(includeIds)}::uuid[])
      ORDER BY sort_order, lower(name)
    `);
    return result.rows;
  }

  async create(dto: CreateItemDto, actor: string): Promise<ItemRow> {
    if (!dto.image_file_id) throw imageRequired();
    if (!dto.unit) throw unitRequired();
    await this.files.assertOwnedBy(dto.image_file_id, actor, 'item_image');
    const fields = {
      max_qty: await this.config.getInt('default_max_qty'),
      ...definedEntries(dto),
    };
    return this.mapConstraints(() =>
      this.db.transaction(async (tx) => {
        const row = (
          await tx.execute<ItemRow>(sql`
            INSERT INTO items (${sql.join(
              Object.keys(fields).map((k) => sql.identifier(k)),
              sql`, `,
            )})
            VALUES (${sql.join(
              Object.values(fields).map((v) => sql`${v}`),
              sql`, `,
            )})
            RETURNING ${ITEM_COLUMNS}
          `)
        ).rows[0];
        await this.audit.appendWithin(tx, {
          actor,
          action: 'item.created',
          objectType: 'item',
          objectId: row.id,
          detail: { after: row },
        });
        return row;
      }),
    );
  }

  async update(
    id: string,
    dto: UpdateItemDto,
    actor: string,
  ): Promise<ItemRow> {
    const patch = definedEntries(dto);
    if ('image_file_id' in patch && !patch.image_file_id) throw imageRequired();
    if ('unit' in patch && !patch.unit) throw unitRequired();
    return this.mapConstraints(() =>
      this.db.transaction(async (tx) => {
        const before = (
          await tx.execute<ItemRow>(sql`
            SELECT ${ITEM_COLUMNS} FROM items WHERE id = ${id} FOR UPDATE
          `)
        ).rows[0];
        if (!before) throw itemNotFound();
        if (Object.keys(patch).length === 0) return before;
        // Ảnh cũ do admin khác tải vẫn giữ được; chỉ ảnh mới phải là của người sửa
        if (
          patch.image_file_id &&
          patch.image_file_id !== before.image_file_id
        ) {
          await this.files.assertOwnedBy(
            patch.image_file_id as string,
            actor,
            'item_image',
          );
        }
        const after = (
          await tx.execute<ItemRow>(sql`
            UPDATE items SET ${setClause(patch)}, updated_at = now()
            WHERE id = ${id} RETURNING ${ITEM_COLUMNS}
          `)
        ).rows[0];
        const keys = Object.keys(patch);
        await this.audit.appendWithin(tx, {
          actor,
          action:
            before.active && !after.active
              ? 'item.deactivated'
              : 'item.updated',
          objectType: 'item',
          objectId: id,
          detail: { before: pick(before, keys), after: pick(after, keys) },
        });
        return after;
      }),
    );
  }

  async remove(id: string, actor: string): Promise<void> {
    if (await this.usage.isUsed(id)) throw itemInUse();
    await this.mapConstraints(() =>
      this.db.transaction(async (tx) => {
        const before = (
          await tx.execute<ItemRow>(sql`
            DELETE FROM items WHERE id = ${id} RETURNING ${ITEM_COLUMNS}
          `)
        ).rows[0];
        if (!before) throw itemNotFound();
        await this.audit.appendWithin(tx, {
          actor,
          action: 'item.deleted',
          objectType: 'item',
          objectId: id,
          detail: { before },
        });
      }),
    );
  }

  private async mapConstraints<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      const mapped = CONSTRAINT_ERRORS[pgViolation(error)?.constraint ?? ''];
      throw mapped ? mapped() : error;
    }
  }
}

function imageRequired() {
  return new BadRequestException({
    code: 'IMAGE_REQUIRED',
    message: 'Món phải có ảnh.',
  });
}

function unitRequired() {
  return new BadRequestException({
    code: 'UNIT_REQUIRED',
    message: 'Chọn đơn vị tính.',
  });
}
