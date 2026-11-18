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
    undoId: string | null;
  },
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO line_deliveries (line_id, qty, movement_id, actor_sub, created_at, undo_id)
    VALUES (${d.lineId}, ${d.qty}, ${d.movementId}, ${d.actor}, ${d.now.toISOString()}::timestamptz, ${d.undoId})
  `);
}

export interface UndoDelivery extends Record<string, unknown> {
  id: string;
  line_id: string;
  request_id: string;
  qty: number;
  movement_id: string | null;
}

export async function deliveriesOfUndo(
  tx: Tx,
  undoIds: string[],
): Promise<UndoDelivery[]> {
  const { rows } = await tx.execute<UndoDelivery>(sql`
    SELECT d.id, d.line_id, l.request_id, d.qty, d.movement_id
    FROM line_deliveries d JOIN request_lines l ON l.id = d.line_id
    WHERE d.undo_id = ANY(${sql.param(undoIds)}::uuid[])
    ORDER BY l.request_id, d.line_id, d.seq
  `);
  return rows;
}

export async function deleteDeliveries(tx: Tx, ids: string[]): Promise<void> {
  await tx.execute(sql`
    DELETE FROM line_deliveries WHERE id = ANY(${sql.param(ids)}::uuid[])
  `);
}

export async function lastDeliveredAt(
  tx: Tx,
  lineId: string,
): Promise<Date | null> {
  const { rows } = await tx.execute<{ at: string | null }>(sql`
    SELECT max(created_at) AS at FROM line_deliveries WHERE line_id = ${lineId}
  `);
  return rows[0].at === null ? null : new Date(rows[0].at);
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
