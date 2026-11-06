import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import type { AdjustReason } from './adjust-rules';

export interface AdjustmentRecord {
  line_id: string;
  item_id: string | null;
  name: string;
  unit: string;
  before: number;
  after: number;
  reason_code: AdjustReason;
  reason_note: string | null;
}

export interface BellLine extends Record<string, unknown> {
  name: string;
  name_en: string | null;
  unit: string;
  before: number;
  after: number;
  reason_code: AdjustReason;
  reason_note: string | null;
}

export async function insertAdjustments(
  tx: Executor,
  args: {
    batchId: string;
    ym: string;
    userSub: string;
    requestId: string;
    actorSub: string;
    now: Date;
    records: AdjustmentRecord[];
  },
): Promise<void> {
  for (const r of args.records) {
    await tx.execute(sql`
      INSERT INTO request_line_adjustments
        (batch_id, period_ym, user_sub, request_id, line_id, item_id, name, unit,
         qty_before, qty_after, reason_code, reason_note, actor_sub, created_at)
      VALUES (${args.batchId}, ${ymToDate(args.ym)}::date, ${args.userSub}, ${args.requestId},
              ${r.line_id}, ${r.item_id}, ${r.name}, ${r.unit}, ${r.before}, ${r.after},
              ${r.reason_code}, ${r.reason_note}, ${args.actorSub}, ${args.now.toISOString()}::timestamptz)
    `);
  }
}

// Mỗi dòng: số đầu ngày → số cuối ngày, lý do của lần cuối; dòng user_left không vào chuông
export async function dayBellLines(
  ex: Executor,
  args: { userSub: string; ym: string; from: Date; to: Date },
): Promise<BellLine[]> {
  const { rows } = await ex.execute<BellLine>(sql`
    WITH d AS (
      SELECT a.*,
             first_value(a.qty_before) OVER (PARTITION BY a.line_id ORDER BY a.created_at, a.id) AS day_before,
             row_number() OVER (PARTITION BY a.line_id ORDER BY a.created_at DESC, a.id DESC) AS rn
      FROM request_line_adjustments a
      WHERE a.user_sub = ${args.userSub} AND a.period_ym = ${ymToDate(args.ym)}::date
        AND a.created_at >= ${args.from.toISOString()}::timestamptz
        AND a.created_at < ${args.to.toISOString()}::timestamptz
        AND a.reason_code <> 'user_left'
    )
    SELECT d.name, i.name_en, d.unit, d.day_before AS before, d.qty_after AS after,
           d.reason_code, d.reason_note
    FROM d
    LEFT JOIN items i ON i.id = d.item_id
    LEFT JOIN item_categories c ON c.id = i.category_id
    WHERE d.rn = 1
    ORDER BY c.sort_order NULLS LAST, c.name, i.sort_order, lower(d.name) COLLATE "C", d.line_id
  `);
  return rows;
}
