import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';

const LINE_ACTIONS = ['line.cancel_remaining', 'line.review'];
const PERIOD_ACTIONS = ['arrival.adm_out_marked', 'arrival.adm_owed_closed'];

// Thay đổi làm số của bản chốt kỳ ym lỗi thời; dòng kỳ trước (nợ) cũng tính vì nằm trong số đề nghị kỳ ym
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
      UNION ALL
      SELECT r.updated_at FROM requests r
      WHERE r.period_ym = ${k}::date AND r.updated_at > ${t}::timestamptz
    ) x`);
  const at = rows[0]?.at;
  return at ? new Date(at) : null;
}

export async function changedAfter(
  ex: Executor,
  ym: string,
  since: Date,
): Promise<boolean> {
  return (await changedAt(ex, ym, since)) !== null;
}
