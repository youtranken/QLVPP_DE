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

interface BellBase extends Record<string, unknown> {
  name: string;
  name_en: string | null;
  unit: string;
}

export interface AdjustBellLine extends BellBase {
  kind: 'adjust';
  before: number;
  after: number;
  reason_code: AdjustReason;
  reason_note: string | null;
}

// Phần chưa giao bị hủy vì ADM hết hàng (hộp giao hoặc tự hủy lúc khóa kỳ sau)
export interface AdmOutBellLine extends BellBase {
  kind: 'adm_out';
  qty: number;
  reason_code: 'adm_out_of_stock';
}

export type BellLine = AdjustBellLine | AdmOutBellLine;

type BellRow = BellBase & {
  kind: BellLine['kind'];
  before: number | null;
  after: number | null;
  qty: number | null;
  reason_code: AdjustReason;
  reason_note: string | null;
};

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

// Mỗi dòng: số đầu ngày → số cuối ngày, lý do của lần cuối; dòng user_left không vào chuông.
// Hủy vì ADM hết hàng đọc từ audit (detail.at theo ClockService) để gộp cùng chuông ngày
export async function dayBellLines(
  ex: Executor,
  args: { userSub: string; ym: string; from: Date; to: Date },
): Promise<BellLine[]> {
  const from = args.from.toISOString();
  const to = args.to.toISOString();
  const { rows } = await ex.execute<BellRow>(sql`
    WITH d AS (
      SELECT a.*,
             first_value(a.qty_before) OVER (PARTITION BY a.line_id ORDER BY a.created_at, a.id) AS day_before,
             row_number() OVER (PARTITION BY a.line_id ORDER BY a.created_at DESC, a.id DESC) AS rn
      FROM request_line_adjustments a
      WHERE a.user_sub = ${args.userSub} AND a.period_ym = ${ymToDate(args.ym)}::date
        AND a.created_at >= ${from}::timestamptz AND a.created_at < ${to}::timestamptz
        AND a.reason_code <> 'user_left'
    ), x AS (
      SELECT 'adjust' AS kind, d.line_id, d.item_id, d.name, d.unit, d.day_before AS before,
             d.qty_after AS after, NULL::int AS qty, d.reason_code, d.reason_note
      FROM d WHERE d.rn = 1
      UNION ALL
      SELECT 'adm_out', l.id, l.item_id, coalesce(i.name, trim(l.custom_name)),
             coalesce(i.unit, trim(l.custom_unit)), NULL, NULL,
             sum((a.detail->>'cancelled_now')::int)::int, 'adm_out_of_stock', NULL
      FROM audit_log a
      JOIN request_lines l ON a.object_type = 'request_line' AND l.id::text = a.object_id
      JOIN requests r ON r.id = l.request_id
      LEFT JOIN items i ON i.id = l.item_id
      WHERE a.action = 'line.cancel_remaining' AND a.detail->>'reason_code' = 'adm_out_of_stock'
        AND r.user_sub = ${args.userSub} AND r.period_ym = ${ymToDate(args.ym)}::date
        AND (a.detail->>'at')::timestamptz >= ${from}::timestamptz
        AND (a.detail->>'at')::timestamptz < ${to}::timestamptz
      GROUP BY l.id, l.item_id, i.name, i.unit, l.custom_name, l.custom_unit
    )
    SELECT x.kind, x.name, i.name_en, x.unit, x.before, x.after, x.qty, x.reason_code, x.reason_note
    FROM x
    LEFT JOIN items i ON i.id = x.item_id
    LEFT JOIN item_categories c ON c.id = i.category_id
    ORDER BY c.sort_order NULLS LAST, c.name, i.sort_order, lower(x.name) COLLATE "C", x.line_id, x.kind
  `);
  return rows.map(toBellLine);
}

function toBellLine(r: BellRow): BellLine {
  const base = { name: r.name, name_en: r.name_en, unit: r.unit };
  return r.kind === 'adm_out'
    ? {
        ...base,
        kind: 'adm_out',
        qty: r.qty ?? 0,
        reason_code: 'adm_out_of_stock',
      }
    : {
        ...base,
        kind: 'adjust',
        before: r.before ?? 0,
        after: r.after ?? 0,
        reason_code: r.reason_code,
        reason_note: r.reason_note,
      };
}
