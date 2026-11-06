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

type BatchLine = { item_id: string; qty: number };

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
  const heads = rows.filter((r) => r.action === 'stock.receipt' && r.object_id);
  const ids = [
    ...new Set(heads.flatMap((r) => linesOf(r.detail).map((l) => l.item_id))),
  ];
  const names = new Map<string, { name: string; name_en: string | null }>();
  if (ids.length > 0) {
    const { rows: found } = await db.execute<{
      id: string;
      name: string;
      name_en: string | null;
    }>(
      sql`SELECT id::text, name, name_en FROM items WHERE id::text = ANY(${sql.param(ids)}::text[])`,
    );
    for (const r of found)
      names.set(r.id, { name: r.name, name_en: r.name_en });
  }
  return new Map(
    heads.map((r) => {
      const items = linesOf(r.detail).map((l) => ({
        item_id: l.item_id,
        name: names.get(l.item_id)?.name ?? '',
        name_en: names.get(l.item_id)?.name_en ?? null,
        qty: l.qty,
      }));
      const units = items.reduce((sum, i) => sum + i.qty, 0);
      return [r.id, { ym: r.object_id!, units, items }];
    }),
  );
}
