import { sql } from 'drizzle-orm';
import type { Executor } from '../../database/database.module';

export interface ReceiptBatch {
  ym: string;
  units: number;
  items: {
    item_id: string;
    name: string;
    name_en: string | null;
    qty: number;
  }[];
}

interface BatchSource {
  id: string;
  action: string;
  object_id: string | null;
  detail: unknown;
}

// Từng món của một lần Lưu hàng về mang batch_id; trang Nhật ký chỉ hiện dòng gộp (lọc theo hành động thì vẫn thấy từng món)
export const notBatchMember = sql`(a.detail->>'batch_id') IS NULL`;

// name/name_en: tên lúc Lưu (dòng cũ không có) — dùng khi món đã bị xóa
type BatchLine = {
  item_id: string;
  qty: number;
  name?: string | null;
  name_en?: string | null;
};

const isLine = (l: unknown): l is BatchLine => {
  const v = l as Partial<Record<keyof BatchLine, unknown>> | null;
  return typeof v?.item_id === 'string' && typeof v?.qty === 'number';
};

const linesOf = (detail: unknown): BatchLine[] => {
  const lines = (detail as { lines?: unknown } | null)?.lines;
  return Array.isArray(lines) ? lines.filter(isLine) : [];
};

// Đọc-only như báo cáo: tên món tra một lần cho cả trang
export async function receiptBatches(
  db: Executor,
  rows: BatchSource[],
): Promise<Map<string, ReceiptBatch>> {
  const receipts = rows.filter(
    (r) => r.action === 'stock.receipt' && r.object_id,
  );
  // Dòng gộp cũ (trước khi từng món mang batch_id) không có món con bị ẩn → gắn batch thì trang hiện cả hai
  const grouped = await groupedHeads(
    db,
    receipts.map((r) => r.id),
  );
  const heads = receipts.filter((r) => grouped.has(r.id));
  const names = await itemNames(
    db,
    heads.flatMap((r) => linesOf(r.detail).map((l) => l.item_id)),
  );
  return new Map(
    heads.map((r) => {
      const items = linesOf(r.detail).map((l) => ({
        item_id: l.item_id,
        name: names.get(l.item_id)?.name ?? l.name ?? '',
        name_en: names.get(l.item_id)?.name_en ?? l.name_en ?? null,
        qty: l.qty,
      }));
      const units = items.reduce((sum, i) => sum + i.qty, 0);
      return [r.id, { ym: r.object_id!, units, items }];
    }),
  );
}

async function groupedHeads(db: Executor, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { rows } = await db.execute<{ id: string }>(
    sql`SELECT DISTINCT a.detail->>'batch_id' AS id FROM audit_log a WHERE a.detail->>'batch_id' = ANY(${sql.param(ids)}::text[])`,
  );
  return new Set(rows.map((r) => r.id));
}

async function itemNames(
  db: Executor,
  list: string[],
): Promise<Map<string, { name: string; name_en: string | null }>> {
  const ids = [...new Set(list)];
  const names = new Map<string, { name: string; name_en: string | null }>();
  if (ids.length === 0) return names;
  const { rows: found } = await db.execute<{
    id: string;
    name: string;
    name_en: string | null;
  }>(
    sql`SELECT id::text, name, name_en FROM items WHERE id::text = ANY(${sql.param(ids)}::text[])`,
  );
  for (const r of found) names.set(r.id, { name: r.name, name_en: r.name_en });
  return names;
}
