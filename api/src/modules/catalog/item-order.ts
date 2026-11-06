import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { SORT_ORDER_MAX } from '../../common/dto-fields';
import type { Executor } from '../../database/database.module';

// Alias c = item_categories (LEFT JOIN), i = items; nhóm NULL/không tồn tại xếp cuối.
// lower(tên) theo mã điểm (COLLATE "C") để comparator web (compareItems) cho đúng cùng dãy.
export const ITEM_ORDER: SQL = sql.raw(
  'c.sort_order NULLS LAST, lower(c.name) COLLATE "C", i.sort_order, lower(i.name) COLLATE "C", i.id',
);

// Không khóa nhóm: hai món tạo song song có thể cùng số, lower(name) rồi id vẫn phân định
export async function nextItemSortOrder(
  tx: Executor,
  categoryId: string | null,
): Promise<number> {
  const { rows } = await tx.execute<{ next: number }>(sql`
    SELECT LEAST(COALESCE(MAX(sort_order), 0) + 10, ${SORT_ORDER_MAX})::int AS next
    FROM items WHERE category_id IS NOT DISTINCT FROM ${categoryId}::uuid
  `);
  return rows[0].next;
}
