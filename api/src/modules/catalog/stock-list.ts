import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { admOwedRows } from '../reports/order-default';
import type { AdmOwedRow } from '../reports/order-default';
import { latestSent } from '../reports/sent-snapshot';
import type { SentSnapshot } from '../reports/sent-snapshot';
import { orderedFromSnapshot } from './arrivals-plan.service';
import { ITEM_ORDER } from './item-order';
import { heldSql } from './stock-held-sql';
import { stockStateOf } from './stock-state';
import type { HeldStock } from './stock-state';

interface StockFactsRow extends Record<string, unknown> {
  item_id: string;
  stock_qty: number;
  restock_level: number | null;
  held: number;
  waiting: number;
  received: number;
  adm_out: boolean;
}

export interface StockListRow extends HeldStock {
  item_id: string;
  stock_qty: number;
  restock_level: number | null;
  held: number;
  waiting: number;
  incoming: number;
}

export async function stockFacts(
  ex: Executor,
  openYm: string,
  kStar: string | null,
  itemId: string | null = null,
): Promise<StockFactsRow[]> {
  const k = kStar ? ymToDate(kStar) : null;
  const { rows } = await ex.execute<StockFactsRow>(sql`
    SELECT i.id AS item_id, i.stock_qty, i.restock_level,
           coalesce(h.held, 0)::int AS held, coalesce(h.waiting, 0)::int AS waiting,
           coalesce((SELECT sum(delta) FROM stock_movements m
                     WHERE m.item_id = i.id AND m.reason = 'purchase'
                       AND m.receipt_ym = ${k}::date), 0)::int AS received,
           EXISTS (SELECT 1 FROM period_adm_out a
                   WHERE a.period_ym = ${k}::date AND a.line_key = i.id::text
                     AND a.kind = 'out') AS adm_out
    FROM items i
    LEFT JOIN item_categories c ON c.id = i.category_id
    LEFT JOIN (${heldSql(openYm)}) h ON h.item_id = i.id
    WHERE ${itemId}::uuid IS NULL OR i.id = ${itemId}::uuid
    ORDER BY ${ITEM_ORDER}`);
  return rows;
}

export interface IncomingSources {
  sent: SentSnapshot | null;
  owed: AdmOwedRow[];
}

// Bản in K* và ADM còn nợ các kỳ trước: đọc một lần, dùng cho cả số đang về lẫn mốc bản in của hộp ngừng món
export async function incomingSources(
  ex: Executor,
  kStar: string | null,
): Promise<IncomingSources> {
  if (!kStar) return { sent: null, owed: [] };
  return {
    sent: await latestSent(ex, kStar),
    owed: await admOwedRows(ex, kStar),
  };
}

// Hàng đang về = phần bản in kỳ K* chưa về (bỏ món ADM hết hàng) + ADM còn nợ giao các kỳ trước
export function incomingByItem(
  src: IncomingSources,
  facts: StockFactsRow[],
): Map<string, number> {
  const incoming = new Map<string, number>();
  const ordered = src.sent
    ? orderedFromSnapshot(src.sent)
    : new Map<string, number>();
  for (const f of facts) {
    const plan = f.adm_out
      ? 0
      : Math.max(0, (ordered.get(f.item_id) ?? 0) - f.received);
    if (plan > 0) incoming.set(f.item_id, plan);
  }
  for (const { key, owed } of src.owed) {
    if (!key.startsWith('custom:'))
      incoming.set(key, (incoming.get(key) ?? 0) + owed);
  }
  return incoming;
}

export async function stockList(
  ex: Executor,
  openYm: string,
  kStar: string | null,
): Promise<StockListRow[]> {
  const facts = await stockFacts(ex, openYm, kStar);
  const incoming = incomingByItem(await incomingSources(ex, kStar), facts);
  return facts.map((f) => {
    const input = {
      stock_qty: f.stock_qty,
      held: f.held,
      restock_level: f.restock_level,
      incoming: incoming.get(f.item_id) ?? 0,
    };
    return {
      item_id: f.item_id,
      ...input,
      waiting: f.waiting,
      ...stockStateOf(input),
    };
  });
}
