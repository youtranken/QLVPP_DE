import { sql } from 'drizzle-orm';
import type { Tx } from '../../database/database.module';

export async function insertLineDelivery(
  tx: Tx,
  d: {
    lineId: string;
    qty: number;
    movementId: string | null;
    actor: string;
    now: Date;
  },
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO line_deliveries (line_id, qty, movement_id, actor_sub, created_at)
    VALUES (${d.lineId}, ${d.qty}, ${d.movementId}, ${d.actor}, ${d.now.toISOString()}::timestamptz)
  `);
}

// n trong event_id request_delivered: tăng chặt theo đợt giao, không đọc audit_log của module khác
export async function countRequestDeliveries(
  tx: Tx,
  requestId: string,
): Promise<number> {
  const { rows } = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM line_deliveries d
    JOIN request_lines l ON l.id = d.line_id
    WHERE l.request_id = ${requestId}
  `);
  return rows[0].n;
}
