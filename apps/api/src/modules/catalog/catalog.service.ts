import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@vpp/shared';
import { asc, count, eq } from 'drizzle-orm';
import { DB, type Db } from '../../infra/db/db.module';
import { categories, items } from '../../infra/db/schema';
import type {
  CreateCategoryDto,
  CreateItemDto,
  UpdateCategoryDto,
  UpdateItemDto,
} from './catalog.dto';

/** Postgres báo vi phạm unique bằng mã 23505. */
const PG_UNIQUE_VIOLATION = '23505';

export interface CatalogCategory {
  id: string;
  name: string;
  isOther: boolean;
  sortOrder: number;
  items: (typeof items.$inferSelect)[];
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Danh mục theo nhóm, đã sắp thứ tự hiển thị.
   * `includeInactive` chỉ dành cho màn quản lý của admin — controller quyết định.
   * Món `adminOnly` VẪN trả về cho member (kèm cờ) để FE hiển thị dạng khoá;
   * chặn thật nằm ở backend lúc nhận đơn (M2).
   */
  async getCatalog(includeInactive = false): Promise<CatalogCategory[]> {
    const rows = await this.db
      .select({ category: categories, item: items })
      .from(categories)
      .leftJoin(items, eq(items.categoryId, categories.id))
      .orderBy(
        asc(categories.sortOrder),
        asc(categories.name),
        asc(items.sortOrder),
        asc(items.name),
      );

    const byId = new Map<string, CatalogCategory>();
    for (const row of rows) {
      let group = byId.get(row.category.id);
      if (!group) {
        group = { ...row.category, items: [] };
        byId.set(row.category.id, group);
      }
      if (row.item && (includeInactive || row.item.active)) group.items.push(row.item);
    }
    return [...byId.values()];
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.guardUnique(async () => {
      const [row] = await this.db.insert(categories).values(dto).returning();
      return row;
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    return this.guardUnique(async () => {
      const [row] = await this.db
        .update(categories)
        .set(dto)
        .where(eq(categories.id, id))
        .returning();
      if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
      return row;
    });
  }

  /** Không xoá nhóm còn món: FK là `restrict`, chặn sớm để báo lỗi rõ ràng hơn. */
  async deleteCategory(id: string): Promise<void> {
    const [{ value: itemCount }] = await this.db
      .select({ value: count() })
      .from(items)
      .where(eq(items.categoryId, id));
    if (itemCount > 0) {
      throw new ConflictException({
        code: ErrorCode.CATEGORY_NOT_EMPTY,
        message: `Nhóm còn ${itemCount} món, hãy xoá hoặc chuyển nhóm cho các món trước.`,
      });
    }
    const deleted = await this.db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    if (deleted.length === 0) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
  }

  async createItem(dto: CreateItemDto) {
    await this.assertCategoryExists(dto.categoryId);
    return this.guardUnique(async () => {
      const [row] = await this.db.insert(items).values(dto).returning();
      return row;
    });
  }

  async updateItem(id: string, dto: UpdateItemDto) {
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    return this.guardUnique(async () => {
      const [row] = await this.db.update(items).set(dto).where(eq(items.id, id)).returning();
      if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
      return row;
    });
  }

  /**
   * Xoá hẳn món. Đơn cũ KHÔNG hỏng: `request_items` đã chụp lại tên/đơn vị và
   * `item_id` chuyển thành null (ON DELETE SET NULL).
   * Muốn giữ món trong lịch sử mà không cho đăng ký nữa thì đặt `active=false`.
   */
  async deleteItem(id: string): Promise<void> {
    const deleted = await this.db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
    if (deleted.length === 0) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (!row) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Không tìm thấy nhóm' });
    }
  }

  /** Đổi vi phạm unique của Postgres thành lỗi nghiệp vụ đọc được. */
  private async guardUnique<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: ErrorCode.DUPLICATE_NAME,
          message: 'Tên đã tồn tại (nhóm trùng tên, hoặc món trùng tên trong cùng nhóm).',
        });
      }
      throw error;
    }
  }
}

/**
 * Drizzle bọc lỗi của driver lại, nên mã lỗi Postgres nằm ở `cause` chứ không ở
 * tầng ngoài cùng — phải lần theo chuỗi `cause` mới thấy.
 */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ((current as { code?: string }).code === PG_UNIQUE_VIOLATION) return true;
  }
  return false;
}
