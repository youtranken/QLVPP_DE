import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { CUSTOM_ITEM_KEY } from '../requests/line-predicates';

const LINE_ACTIONS = ['line.cancel_remaining', 'line.review'];
// Bỏ đánh dấu cũng đổi số đề nghị (adm_owed) nên tính như đánh dấu
const PERIOD_ACTIONS = [
  'arrival.adm_out_marked',
  'arrival.adm_out_unmarked',
  'arrival.adm_owed_closed',
  'arrival.adm_owed_reopened',
];

// Chỉ sự kiện đổi căn cứ đề nghị; không dùng requests.updated_at vì giao hàng cũng chạm nó. Dòng kỳ trước (nợ) tính vì nằm trong đề nghị kỳ ym
export async function changedAt(
  ex: Executor,
  ym: string,
  since: Date,
): Promise<Date | null> {
  const k = ymToDate(ym);
  const t = since.toISOString();
  const { rows } = await ex.execute<{ at: Date | string | null }>(sql`
    SELECT max(at) AS at FROM (
      SELECT a.created_at AS at FROM audit_log a
      JOIN requests r ON a.object_type = 'request' AND r.id::text = a.object_id
      WHERE a.action = 'request.updated' AND a.created_at > ${t}::timestamptz
        AND r.period_ym <= ${k}::date
      UNION ALL
      SELECT a.created_at FROM audit_log a
      JOIN request_lines l ON a.object_type = 'request_line' AND l.id::text = a.object_id
      JOIN requests r ON r.id = l.request_id
      WHERE a.action = ANY(${sql.param(LINE_ACTIONS)}::text[])
        AND a.created_at > ${t}::timestamptz AND r.period_ym <= ${k}::date
      UNION ALL
      SELECT a.created_at FROM audit_log a
      WHERE a.action = ANY(${sql.param(PERIOD_ACTIONS)}::text[])
        AND a.object_type = 'period' AND a.object_id <= ${ym}
        AND a.created_at > ${t}::timestamptz
    ) x`);
  const at = rows[0]?.at;
  return at ? new Date(at) : null;
}

// Dòng đã nằm trong căn cứ lúc chốt (có trước bản, đã duyệt trước bản) của người đang làm việc, kỳ ≤ ym
const basisLine = (ym: string, t: string) => sql`
  r.period_ym <= ${ymToDate(ym)}::date AND u.status = 'active'
  AND l.created_at <= ${t}::timestamptz
  AND (l.reviewed_at IS NULL OR l.reviewed_at <= ${t}::timestamptz)`;

// Phần hủy vì NCC hết hàng sau bản chốt (hủy khi giao hoặc tự hủy cuối kỳ), theo khóa: như giao, là hệ quả của nhận/giao hàng
// kỳ này chứ không đổi đơn — web cộng lại vào cần nay để món không bị báo "đổi sau bản này"
export async function admCancelledSince(
  ex: Executor,
  ym: string,
  since: Date,
): Promise<Record<string, number>> {
  const t = since.toISOString();
  const { rows } = await ex.execute<{ key: string; qty: number }>(sql`
    SELECT coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key,
           sum((a.detail->>'cancelled_now')::int)::int AS qty
    FROM audit_log a
    JOIN request_lines l ON a.object_type = 'request_line' AND l.id::text = a.object_id
    JOIN requests r ON r.id = l.request_id
    JOIN users u ON u.sub = r.user_sub
    WHERE a.action = 'line.cancel_remaining' AND a.detail->>'reason_code' = 'adm_out_of_stock'
      AND a.created_at > ${t}::timestamptz AND ${basisLine(ym, t)}
    GROUP BY 1`);
  return Object.fromEntries(rows.map((r) => [r.key, r.qty]));
}

// Phần đã giao sau bản chốt cho dòng đã nằm trong căn cứ lúc chốt (có trước bản, đã duyệt trước bản) của người đang làm việc, theo khóa: cộng lại vào cần nay thì ra số so được với cần lúc chốt (giao không phải thay đổi)
export async function deliveredSince(
  ex: Executor,
  ym: string,
  since: Date,
): Promise<Record<string, number>> {
  const t = since.toISOString();
  const { rows } = await ex.execute<{ key: string; qty: number }>(sql`
    SELECT coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key, sum(d.qty)::int AS qty
    FROM line_deliveries d
    JOIN request_lines l ON l.id = d.line_id
    JOIN requests r ON r.id = l.request_id
    JOIN users u ON u.sub = r.user_sub
    WHERE d.created_at > ${t}::timestamptz AND ${basisLine(ym, t)}
    GROUP BY 1`);
  return Object.fromEntries(rows.map((r) => [r.key, r.qty]));
}
