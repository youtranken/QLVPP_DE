import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import { CUSTOM_ITEM_KEY } from '../requests/line-predicates';

const ADM_OUT = 'adm_out_of_stock';

// Cùng luật với nhãn "đổi sau bản này" ở web: chỉ thay đổi đổi cần — đăng ký/điều chỉnh sau bản, duyệt món ngoài DM, Hủy nợ mã khác.
// Giao hàng, hủy vì NCC hết hàng, đánh dấu/đóng nợ NCC là hệ quả của nhận/giao hàng kỳ đó, không tính.
// Không dùng requests.updated_at vì giao hàng cũng chạm nó. Dòng kỳ trước (nợ) tính vì nằm trong đề nghị kỳ ym
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
      WHERE (a.action = 'line.review'
             OR (a.action = 'line.cancel_remaining'
                 AND a.detail->>'reason_code' IS DISTINCT FROM ${ADM_OUT}))
        AND a.created_at > ${t}::timestamptz AND r.period_ym <= ${k}::date
    ) x`);
  const at = rows[0]?.at;
  return at ? new Date(at) : null;
}

// Phần đã xong sau bản chốt theo khóa = đã giao + đã hủy vì NCC hết hàng (hủy khi giao, tự hủy cuối kỳ, hủy nợ mã này),
// chỉ dòng có trong căn cứ lúc chốt (có trước bản, đã duyệt trước bản) của người đang làm việc, kỳ ≤ ym.
// Web cộng vào cần nay để so với cần lúc chốt: nhận/giao hàng kỳ đó không phải thay đổi đơn.
// Phần hủy lấy theo before/after của audit (đường hủy thường không ghi cancelled_now)
export async function settledSince(
  ex: Executor,
  ym: string,
  since: Date,
): Promise<Record<string, number>> {
  const t = since.toISOString();
  const { rows } = await ex.execute<{ key: string; qty: number }>(sql`
    WITH done AS (
      SELECT d.line_id, d.qty FROM line_deliveries d
      WHERE d.created_at > ${t}::timestamptz
      UNION ALL
      SELECT a.object_id::uuid,
             (a.detail->'after'->>'cancelled_qty')::int - (a.detail->'before'->>'cancelled_qty')::int
      FROM audit_log a
      WHERE a.action = 'line.cancel_remaining' AND a.object_type = 'request_line'
        AND a.detail->>'reason_code' = ${ADM_OUT} AND a.created_at > ${t}::timestamptz
    )
    SELECT coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) AS key, sum(x.qty)::int AS qty
    FROM done x
    JOIN request_lines l ON l.id = x.line_id
    JOIN requests r ON r.id = l.request_id
    JOIN users u ON u.sub = r.user_sub
    WHERE r.period_ym <= ${ymToDate(ym)}::date AND u.status = 'active'
      AND l.created_at <= ${t}::timestamptz
      AND (l.reviewed_at IS NULL OR l.reviewed_at <= ${t}::timestamptz)
    GROUP BY 1`);
  return Object.fromEntries(rows.map((r) => [r.key, r.qty]));
}
