import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { pgViolation } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { SystemConfigService } from '../config/system-config.service';
import { FilesService } from '../files/files.service';
import { unknownUnit } from '../units/unit-errors';
import { UnitsService } from '../units/units.service';
import type { CreateItemDto, UpdateItemDto } from './catalog.dto';
import { definedEntries, pick, setClause } from '../../common/sql-patch';
import { ITEM_COLUMNS, ITEM_USABLE_SQL, LOW_STOCK_SQL } from './catalog-sql';
import type { ItemFacts, ItemRow } from './catalog-sql';
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
  // ĐVT bị xóa giữa lúc kiểm active và lúc ghi món
  items_unit_fkey: () => unknownUnit('unit'),
  items_code_key: () =>
    new ConflictException({
      code: 'ITEM_CODE_EXISTS',
      message: 'Mã món đã được dùng.',
    }),
  stock_movements_item_id_fkey: () => itemInUse(),
  // Dòng phiếu chèn sau lúc kiểm isUsed nhưng trước DELETE
  request_lines_item_id_fkey: () => itemInUse(),
  // Ảnh bị job dọn tệp mồ côi xóa giữa lúc kiểm quyền và lúc ghi món
  items_image_file_id_fkey: () =>
    new BadRequestException({
      code: 'IMAGE_REQUIRED',
      message: 'Ảnh không còn — tải ảnh lại.',
    }),
};

export function itemConstraintError(error: unknown): unknown {
  const mapped = CONSTRAINT_ERRORS[pgViolation(error)?.constraint ?? ''];
  return mapped ? mapped() : error;
}

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
    private readonly units: UnitsService,
    @Inject(ITEM_USAGE_HOOK) private readonly usage: ItemUsageHook,
  ) {}

  // active ở đây = dùng được (tính cả nhóm); lockCategories chặn đua với tx ngừng nhóm/chuyển nhóm đang chạy
  // — dựa vào PATCH admin/items lấy FOR UPDATE trên items (xung đột FOR KEY SHARE) khi đổi category_id
  async itemFacts(
    ids: string[],
    tx: Executor = this.db,
    opts: { lockCategories?: boolean } = {},
  ): Promise<Map<string, ItemFacts>> {
    if (ids.length === 0) return new Map();
    const idList = sql`${sql.param(ids)}::uuid[]`;
    if (opts.lockCategories) {
      await tx.execute(sql`
        SELECT id FROM items WHERE id = ANY(${idList}) ORDER BY id FOR KEY SHARE
      `);
      await tx.execute(sql`
        SELECT id FROM item_categories
        WHERE id IN (SELECT category_id FROM items WHERE id = ANY(${idList}))
        ORDER BY id FOR SHARE
      `);
    }
    const { rows } = await tx.execute<ItemFacts>(sql`
      SELECT id, name, name_en, unit, pack_note, image_file_id, ${ITEM_USABLE_SQL} AS active,
             admin_only, max_qty
      FROM items WHERE id = ANY(${idList})
    `);
    return new Map(rows.map((r) => [r.id, r]));
  }

  async countLowStock(): Promise<number> {
    const { rows } = await this.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM items WHERE active AND ${sql.raw(LOW_STOCK_SQL)}
    `);
    return rows[0].n;
  }

  // missing_image: món seed chưa có ảnh để admin biết cần bổ sung
  // Id được liệt kê vẫn trả dù ngừng/admin_only: để member xem lại dòng cũ trong phiếu của mình
  // Xếp theo nhóm trước (cùng thứ tự chip nhóm) để trang Đăng ký không trộn món các nhóm
  async listFor(
    identity: RequestIdentity,
    includeIds: string[] = [],
  ): Promise<(ItemRow & { usable: boolean; missing_image: boolean })[]> {
    const privileged = identity.role === 'admin' || identity.role === 'sa';
    const result = await this.db.execute<
      ItemRow & { usable: boolean; missing_image: boolean }
    >(sql`
      SELECT ${ITEM_COLUMNS}, ${ITEM_USABLE_SQL} AS usable,
             (image_file_id IS NULL) AS missing_image
      FROM items
      LEFT JOIN LATERAL (
        SELECT sort_order AS group_sort, lower(name) AS group_name
        FROM item_categories WHERE id = items.category_id
      ) g ON true
      WHERE ${privileged}
         OR (${ITEM_USABLE_SQL} AND NOT admin_only)
         OR id = ANY(${sql.param(includeIds)}::uuid[])
      ORDER BY g.group_sort NULLS LAST, g.group_name NULLS LAST, items.sort_order, lower(items.name)
    `);
    return result.rows;
  }

  async create(dto: CreateItemDto, actor: string): Promise<ItemRow> {
    return this.db.transaction((tx) => this.createItemWithin(tx, dto, actor));
  }

  // Cho review món ngoài DM tạo món trong tx của nó; trustedImageId = ảnh đã nằm trên dòng phiếu, không kiểm chủ
  async createItemWithin(
    tx: Tx,
    dto: CreateItemDto,
    actor: string,
    opts: { trustedImageId?: string } = {},
  ): Promise<ItemRow> {
    if (!dto.image_file_id) throw imageRequired();
    if (!dto.unit) throw unitRequired();
    await this.units.assertActive(dto.unit, tx);
    if (dto.image_file_id !== opts.trustedImageId) {
      await this.files.assertOwnedBy(dto.image_file_id, actor, 'item_image');
    }
    const fields = {
      max_qty: await this.config.getInt('default_max_qty'),
      ...definedEntries(dto),
    };
    const row = await this.mapConstraints(
      async () =>
        (
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
        ).rows[0],
    );
    await this.audit.appendWithin(tx, {
      actor,
      action: 'item.created',
      objectType: 'item',
      objectId: row.id,
      detail: { after: row },
    });
    return row;
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
        // Giữ nguyên ĐVT đã ngừng của món cũ vẫn lưu được; chỉ chọn mới mới phải active
        if (patch.unit && patch.unit !== before.unit) {
          await this.units.assertActive(patch.unit as string, tx);
        }
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
    await this.mapConstraints(() =>
      this.db.transaction(async (tx) => {
        if (await this.usage.isUsed(id, tx)) throw itemInUse();
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
      throw itemConstraintError(error);
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
