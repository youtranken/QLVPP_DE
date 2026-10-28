import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './catalog.dto';
import {
  CATEGORY_COLUMNS,
  definedEntries,
  pgViolation,
  pick,
  setClause,
} from './catalog-sql';
import type { CategoryRow } from './catalog-sql';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
  ) {}

  async list(includeInactive: boolean): Promise<CategoryRow[]> {
    const result = await this.db.execute<CategoryRow>(sql`
      SELECT ${CATEGORY_COLUMNS} FROM item_categories
      WHERE ${includeInactive} OR active
      ORDER BY sort_order, lower(name)
    `);
    return result.rows;
  }

  async create(dto: CreateCategoryDto, actor: string): Promise<CategoryRow> {
    return this.mapDuplicate(() =>
      this.db.transaction(async (tx) => {
        const fields = definedEntries(dto);
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
  ): Promise<CategoryRow> {
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
        await this.audit.appendWithin(tx, {
          actor,
          action: 'category.updated',
          objectType: 'item_category',
          objectId: id,
          detail: { before: pick(before, keys), after: pick(after, keys) },
        });
        return after;
      }),
    );
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
