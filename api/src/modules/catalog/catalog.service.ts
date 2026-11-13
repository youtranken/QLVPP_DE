import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor, Tx } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { SystemConfigService } from '../config/system-config.service';
import { FilesService } from '../files/files.service';
import { UnitsService } from '../units/units.service';
import type { CreateItemDto, UpdateItemDto } from './catalog.dto';
import { definedEntries, pick, setClause } from '../../common/sql-patch';
import {
  ITEM_COLUMNS,
  ITEM_INACTIVE_REASON_SQL,
  ITEM_USABLE_SQL,
} from './catalog-sql';
import type {
  InactiveReason,
  ItemDbRow,
  ItemFacts,
  ItemRow,
} from './catalog-sql';
import { catalogStates, lowStockIds, withStockState } from './stock-list';
import { ITEM_ORDER, nextItemSortOrder } from './item-order';
import { ITEM_USAGE_HOOK } from './item-usage.hook';
import type { ItemUsageHook } from './item-usage.hook';
import {
  imageRequired,
  itemConstraintError,
  itemInUse,
  itemNotFound,
  unitRequired,
} from './item-errors';

type ListedItem = ItemRow & {
  usable: boolean;
  inactive_reason: InactiveReason;
  missing_image: boolean;
};

// Nhân viên chỉ nhận đúng trường màn đặt món dùng (MemberItem ở web); tồn kho, mức đặt lại, mã món,
// trạng thái kho là dữ liệu nội bộ của Hành chính — cắt ở server, không chỉ ẩn ở giao diện
const MEMBER_ITEM_KEYS = [
  'id',
  'name',
  'name_en',
  'unit',
  'pack_note',
  'category_id',
  'image_file_id',
  'admin_only',
  'max_qty',
  'active',
  'usable',
] as const;
export type MemberListedItem = Pick<
  ListedItem,
  (typeof MEMBER_ITEM_KEYS)[number]
>;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
    private readonly files: FilesService,
    private readonly config: SystemConfigService,
    private readonly units: UnitsService,
    @Inject(ITEM_USAGE_HOOK) private readonly usage: ItemUsageHook,
    private readonly periods: PeriodsService,
  ) {}

  // Trạng thái kho theo Tủ (đang giữ, hàng đang về); một món thì chỉ tính món đó
  private async withState(
    ex: Executor,
    rows: ItemDbRow[],
    itemId: string | null = null,
  ): Promise<ItemRow[]> {
    const { openYm, kStar } = await this.periods.stockPeriods(undefined, ex);
    return withStockState(rows, await catalogStates(ex, openYm, kStar, itemId));
  }

  private async oneWithState(ex: Executor, row: ItemDbRow): Promise<ItemRow> {
    return (await this.withState(ex, [row], row.id))[0];
  }

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
    const { openYm, kStar } = await this.periods.stockPeriods();
    const ids = lowStockIds(await catalogStates(this.db, openYm, kStar));
    const { rows } = await this.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM items
      WHERE active AND id = ANY(${sql.param(ids)}::uuid[])
    `);
    return rows[0].n;
  }

  // missing_image: món seed chưa có ảnh để admin biết cần bổ sung
  // Member thấy cả món tạm ngưng (usable=false) để thẻ hiện con dấu; admin_only vẫn ẩn trừ id được liệt kê (dòng cũ trong phiếu)
  async listFor(
    identity: RequestIdentity,
    includeIds: string[] = [],
  ): Promise<ListedItem[] | MemberListedItem[]> {
    const privileged = identity.role === 'admin' || identity.role === 'sa';
    const result = await this.db.execute<ListedItem & ItemDbRow>(sql`
      SELECT i.* FROM (
        SELECT ${ITEM_COLUMNS}, ${ITEM_USABLE_SQL} AS usable,
               ${ITEM_INACTIVE_REASON_SQL} AS inactive_reason,
               (image_file_id IS NULL) AS missing_image
        FROM items
        WHERE ${privileged}
           OR NOT admin_only
           OR id = ANY(${sql.param(includeIds)}::uuid[])
      ) i
      LEFT JOIN item_categories c ON c.id = i.category_id
      ORDER BY ${ITEM_ORDER}
    `);
    if (!privileged) {
      return result.rows.map(
        (r) => pick(r, [...MEMBER_ITEM_KEYS]) as MemberListedItem,
      );
    }
    return this.withState(this.db, result.rows) as Promise<ListedItem[]>;
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
      sort_order:
        dto.sort_order ??
        (await nextItemSortOrder(tx, dto.category_id ?? null)),
      ...definedEntries(dto),
    };
    const row = await this.mapConstraints(
      async () =>
        (
          await tx.execute<ItemDbRow>(sql`
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
    // Món mới chưa ai giữ, chưa có hàng đang về
    return withStockState([row], new Map())[0];
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
          await tx.execute<ItemDbRow>(sql`
            SELECT ${ITEM_COLUMNS} FROM items WHERE id = ${id} FOR UPDATE
          `)
        ).rows[0];
        if (!before) throw itemNotFound();
        if (Object.keys(patch).length === 0)
          return this.oneWithState(tx, before);
        if (
          'category_id' in patch &&
          !('sort_order' in patch) &&
          patch.category_id !== before.category_id
        ) {
          patch.sort_order = await nextItemSortOrder(
            tx,
            patch.category_id as string | null,
          );
        }
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
          await tx.execute<ItemDbRow>(sql`
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
        return this.oneWithState(tx, after);
      }),
    );
  }

  async remove(id: string, actor: string): Promise<void> {
    await this.mapConstraints(() =>
      this.db.transaction(async (tx) => {
        if (await this.usage.isUsed(id, tx)) throw itemInUse();
        const before = (
          await tx.execute<ItemDbRow>(sql`
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
