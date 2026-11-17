import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { SORT_ORDER_MAX } from '../../common/dto-fields';
import { pgViolation } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './catalog.dto';
import { definedEntries, pick, setClause } from '../../common/sql-patch';
import { CATEGORY_COLUMNS } from './catalog-sql';
import type { CategoryRow } from './catalog-sql';

type AffectedItems =
  | { reactivated: number; still_inactive: number }
  | { deactivated: number; still_inactive: number };

const SORT_LOCK = sql.raw("hashtext('item_categories.sort_order')");

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
  ) {}

  // Member vẫn thấy món của nhóm ngừng (usable=false) nên cần nhãn nhóm đó; nhóm ngừng rỗng thì ẩn
  async list(includeInactive: boolean): Promise<CategoryRow[]> {
    const result = await this.db.execute<CategoryRow>(sql`
      SELECT ${CATEGORY_COLUMNS} FROM item_categories
      WHERE ${includeInactive} OR active
         OR EXISTS (
           SELECT 1 FROM items i WHERE i.category_id = item_categories.id
         )
      ORDER BY sort_order, lower(name)
    `);
    return result.rows;
  }

  async create(dto: CreateCategoryDto, actor: string): Promise<CategoryRow> {
    return this.mapDuplicate(() =>
      this.db.transaction(async (tx) => {
        const fields = {
          ...definedEntries(dto),
          sort_order: dto.sort_order ?? (await this.nextSortOrder(tx)),
        };
        const result = await tx.execute<CategoryRow>(sql`
          INSERT INTO item_categories (${sql.join(
            Object.keys(fields).map((k) => sql.identifier(k)),
            sql`, `,
          )})
          VALUES (${sql.join(
            Object.values(fields).map((v) => sql`${v}`),
            sql`, `,
          )})
          RETURNING ${CATEGORY_COLUMNS}
        `);
        const row = result.rows[0];
        await this.audit.appendWithin(tx, {
          actor,
          action: 'category.created',
          objectType: 'item_category',
          objectId: row.id,
          detail: { after: row },
        });
        return row;
      }),
    );
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    actor: string,
  ): Promise<CategoryRow & { affected_items?: AffectedItems }> {
    const patch = definedEntries(dto);
    return this.mapDuplicate(() =>
      this.db.transaction(async (tx) => {
        const before = (
          await tx.execute<CategoryRow>(sql`
            SELECT ${CATEGORY_COLUMNS} FROM item_categories WHERE id = ${id} FOR UPDATE
          `)
        ).rows[0];
        if (!before) {
          throw new NotFoundException({
            code: 'CATEGORY_NOT_FOUND',
            message: 'Không tìm thấy nhóm món.',
          });
        }
        if (Object.keys(patch).length === 0) return before;
        const after = (
          await tx.execute<CategoryRow>(sql`
            UPDATE item_categories SET ${setClause(patch)}, updated_at = now()
            WHERE id = ${id} RETURNING ${CATEGORY_COLUMNS}
          `)
        ).rows[0];
        const keys = Object.keys(patch);
        const affected =
          before.active === after.active
            ? undefined
            : await this.affectedItems(tx, id, after.active);
        await this.audit.appendWithin(tx, {
          actor,
          action: 'category.updated',
          objectType: 'item_category',
          objectId: id,
          detail: {
            before: pick(before, keys),
            after: pick(after, keys),
            ...(affected && { affected_items: affected }),
          },
        });
        return affected && 'reactivated' in affected
          ? { ...after, affected_items: affected }
          : after;
      }),
    );
  }

  // Ngừng nhóm không ghi items.active: món còn active = món theo nhóm, món active=false = ngừng riêng
  private async affectedItems(
    tx: Tx,
    id: string,
    nowActive: boolean,
  ): Promise<AffectedItems> {
    const { rows } = await tx.execute<{ on: number; off: number }>(sql`
      SELECT count(*) FILTER (WHERE active)::int AS on,
             count(*) FILTER (WHERE NOT active)::int AS off
      FROM items WHERE category_id = ${id}
    `);
    const { on, off } = rows[0];
    return nowActive
      ? { reactivated: on, still_inactive: off }
      : { deactivated: on, still_inactive: off };
  }

  // Khóa tư vấn: hai lần thêm đồng thời không cùng nhận max + 10
  private async nextSortOrder(tx: Tx): Promise<number> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SORT_LOCK})`);
    const { rows } = await tx.execute<{ next: number }>(
      sql`SELECT LEAST(COALESCE(MAX(sort_order), 0) + 10, ${SORT_ORDER_MAX}) AS next FROM item_categories`,
    );
    return rows[0].next;
  }

  private async mapDuplicate<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (pgViolation(error)?.constraint === 'item_categories_name_uq') {
        throw new ConflictException({
          code: 'CATEGORY_EXISTS',
          message: 'Đã có nhóm món cùng tên.',
        });
      }
      throw error;
    }
  }
}
