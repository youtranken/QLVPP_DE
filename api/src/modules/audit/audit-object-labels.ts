import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Executor } from '../../database/database.module';

export interface ObjectLabel {
  name: string | null;
  ym: string | null;
  owner: string | null;
}

export interface ObjectRef {
  objectType: string | null;
  objectId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

type Row = {
  id: string;
  name?: string | null;
  ym?: string | null;
  owner?: string | null;
};
const uuids = (ids: string[]) => sql`${sql.param(ids)}::uuid[]`;
const texts = (ids: string[]) => sql`${sql.param(ids)}::text[]`;

// Đọc-only như báo cáo: tra thẳng bảng của module khác để nhật ký hiện tên thay cho id
const LOOKUPS: Record<
  string,
  { uuid: boolean; query: (ids: string[]) => SQL }
> = {
  item: {
    uuid: true,
    query: (ids) =>
      sql`SELECT id::text, name FROM items WHERE id = ANY(${uuids(ids)})`,
  },
  item_category: {
    uuid: true,
    query: (ids) =>
      sql`SELECT id::text, name FROM item_categories WHERE id = ANY(${uuids(ids)})`,
  },
  unit: {
    uuid: false,
    query: (ids) =>
      sql`SELECT code AS id, name FROM units WHERE code = ANY(${texts(ids)})`,
  },
  user: {
    uuid: false,
    query: (ids) =>
      sql`SELECT sub AS id, full_name AS name FROM users WHERE sub = ANY(${texts(ids)}) AND full_name IS NOT NULL`,
  },
  request: {
    uuid: true,
    query: (ids) => sql`
      SELECT r.id::text, to_char(r.period_ym, 'YYYY-MM') AS ym,
             coalesce(u.full_name, r.user_sub) AS owner
      FROM requests r LEFT JOIN users u ON u.sub = r.user_sub
      WHERE r.id = ANY(${uuids(ids)})`,
  },
  request_line: {
    uuid: true,
    query: (ids) => sql`
      SELECT l.id::text, coalesce(i.name, l.custom_name) AS name,
             to_char(r.period_ym, 'YYYY-MM') AS ym, coalesce(u.full_name, r.user_sub) AS owner
      FROM request_lines l
      JOIN requests r ON r.id = l.request_id
      LEFT JOIN users u ON u.sub = r.user_sub
      LEFT JOIN items i ON i.id = l.item_id
      WHERE l.id = ANY(${uuids(ids)})`,
  },
  report_snapshot: {
    uuid: true,
    query: (ids) => sql`
      SELECT id::text, to_char(period_ym, 'YYYY-MM') AS ym
      FROM report_snapshots WHERE id = ANY(${uuids(ids)})`,
  },
};

const keyOf = (type: string, id: string) => `${type}\u0000${id}`;

// Một truy vấn cho mỗi loại đối tượng có trên trang, không tra từng dòng
export async function resolveObjectLabels(
  db: Executor,
  refs: ObjectRef[],
): Promise<(ObjectLabel | null)[]> {
  const byType = new Map<string, Set<string>>();
  for (const { objectType: type, objectId: id } of refs) {
    const lookup = type ? LOOKUPS[type] : undefined;
    if (!type || !id || !lookup || (lookup.uuid && !UUID.test(id))) continue;
    byType.set(type, (byType.get(type) ?? new Set()).add(id));
  }
  const found = new Map<string, ObjectLabel>();
  await Promise.all(
    [...byType].map(async ([type, ids]) => {
      const { rows } = await db.execute<Row>(LOOKUPS[type].query([...ids]));
      for (const r of rows) {
        found.set(keyOf(type, r.id), {
          name: r.name ?? null,
          ym: r.ym ?? null,
          owner: r.owner ?? null,
        });
      }
    }),
  );
  return refs.map(({ objectType: type, objectId: id }) => {
    if (!type || !id) return null;
    if (type === 'period' && YM.test(id))
      return { name: null, ym: id, owner: null };
    return (
      found.get(keyOf(type, LOOKUPS[type]?.uuid ? id.toLowerCase() : id)) ??
      null
    );
  });
}
