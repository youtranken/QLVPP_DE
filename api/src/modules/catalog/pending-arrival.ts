import { sql } from 'drizzle-orm';
import type { Executor } from '../../database/database.module';
import { latestSent } from '../reports/sent-snapshot';
import { orderedFromSnapshot } from './arrivals-plan.service';
import { itemNotFound } from './item-errors';
import { incomingByItem, incomingSources, stockFacts } from './stock-list';
import type { IncomingSources } from './stock-list';

export type PendingArrival =
  { remaining: number; unit: string; snapshot_at: string } | { remaining: 0 };

// Cùng "Hàng đang về" của Tủ (cùng K* = kỳ khóa gần nhất): phần bản in K* chưa về + ADM còn nợ các kỳ trước;
// mốc = bản in K*, không có món thì bản kỳ còn nợ gần nhất
export async function pendingArrival(
  ex: Executor,
  itemId: string,
  openYm: string,
  kStar: string | null,
): Promise<PendingArrival> {
  const { rows } = await ex.execute<{ unit: string }>(
    sql`SELECT unit FROM items WHERE id = ${itemId}`,
  );
  if (!rows[0]) throw itemNotFound();
  const facts = await stockFacts(ex, openYm, kStar, itemId);
  const src = await incomingSources(ex, kStar);
  const remaining = incomingByItem(src, facts).get(itemId) ?? 0;
  if (remaining === 0) return { remaining: 0 };
  const sheet = await sheetOf(ex, src, itemId);
  if (!sheet) return { remaining: 0 };
  return { remaining, unit: rows[0].unit, snapshot_at: sheet.created_at };
}

async function sheetOf(ex: Executor, src: IncomingSources, itemId: string) {
  if (src.sent && (orderedFromSnapshot(src.sent).get(itemId) ?? 0) > 0)
    return src.sent;
  const last = src.owed.filter((r) => r.key === itemId).at(-1);
  return last ? latestSent(ex, last.period_ym) : null;
}
