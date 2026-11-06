import { sql } from 'drizzle-orm';
import { addMonths } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { admOwedRows } from '../reports/order-default';
import { latestSent } from '../reports/sent-snapshot';
import { orderedFromSnapshot } from './arrivals-plan.service';
import { itemNotFound } from './catalog.service';
import { incomingByItem, stockFacts } from './stock-list';

export type PendingArrival =
  { remaining: number; unit: string; snapshot_at: string } | { remaining: 0 };

// Cùng "Hàng đang về" của Tủ: phần bản in kỳ khóa chưa về + ADM còn nợ các kỳ trước; mốc = bản in kỳ khóa, không có món thì bản kỳ còn nợ gần nhất
export async function pendingArrival(
  ex: Executor,
  itemId: string,
  openYm: string,
): Promise<PendingArrival> {
  const { rows } = await ex.execute<{ unit: string }>(
    sql`SELECT unit FROM items WHERE id = ${itemId}`,
  );
  if (!rows[0]) throw itemNotFound();
  const kStar = addMonths(openYm, -1);
  const facts = await stockFacts(ex, openYm, kStar, itemId);
  const remaining = (await incomingByItem(ex, kStar, facts)).get(itemId) ?? 0;
  if (remaining === 0) return { remaining: 0 };
  const sheet = await sheetOf(ex, kStar, itemId);
  if (!sheet) return { remaining: 0 };
  return { remaining, unit: rows[0].unit, snapshot_at: sheet.created_at };
}

async function sheetOf(ex: Executor, kStar: string, itemId: string) {
  const sent = await latestSent(ex, kStar);
  if (sent && (orderedFromSnapshot(sent).get(itemId) ?? 0) > 0) return sent;
  const owed = (await admOwedRows(ex, kStar)).filter((r) => r.key === itemId);
  const last = owed.at(-1);
  return last ? latestSent(ex, last.period_ym) : null;
}
