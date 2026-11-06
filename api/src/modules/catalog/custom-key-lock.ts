import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { CUSTOM_ITEM_KEY } from '../requests/line-predicates';

// Khóa ngoài DM không có dòng nào để FOR UPDATE: "Đã về" và giao cùng (kỳ, khóa) tuần tự hóa qua khóa tư vấn của tx
export async function lockCustomKey(
  ex: Executor,
  ym: string,
  key: string,
): Promise<void> {
  await ex.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`custom-key|${ym}|${key}`}))`,
  );
}

export async function customReceived(
  ex: Executor,
  ym: string,
  key: string,
): Promise<number> {
  const { rows } = await ex.execute<{ n: number }>(sql`
    SELECT coalesce(sum(qty), 0)::int AS n FROM custom_receipts
    WHERE period_ym = ${ymToDate(ym)}::date AND line_key = ${key}`);
  return rows[0].n;
}

export async function customDelivered(
  ex: Executor,
  ym: string,
  key: string,
): Promise<number> {
  const { rows } = await ex.execute<{ n: number }>(sql`
    SELECT coalesce(sum(l.delivered_qty), 0)::int AS n
    FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE r.period_ym = ${ymToDate(ym)}::date AND l.item_id IS NULL
      AND ${CUSTOM_ITEM_KEY} = ${key}`);
  return rows[0].n;
}

export async function lineKeyOf(ex: Executor, lineId: string): Promise<string> {
  const { rows } = await ex.execute<{ key: string }>(sql`
    SELECT coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key
    FROM request_lines l WHERE l.id = ${lineId}`);
  return rows[0].key;
}
