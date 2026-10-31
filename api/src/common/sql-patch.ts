import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// Chỉ nhận khóa đã qua DTO whitelist; tên cột là định danh có quote, giá trị là tham số
export function setClause(patch: Record<string, unknown>): SQL {
  return sql.join(
    Object.entries(patch).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`),
    sql`, `,
  );
}

export function definedEntries<T extends object>(
  dto: T,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(dto).filter(([, v]) => v !== undefined),
  );
}

export function pick(
  row: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, row[k]]));
}
