import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor, Tx } from '../../database/database.module';
import type { AuditWriterService } from '../audit/audit-writer.service';

export interface NoOrderFlag {
  no_order_at: string | null;
  no_order_by: string | null;
}

export interface NoOrderMark {
  at: string;
  by_name: string | null;
}

export async function noOrderOf(
  ex: Executor,
  ym: string,
): Promise<NoOrderMark | null> {
  const { rows } = await ex.execute<{
    no_order_at: Date | string | null;
    no_order_by_name: string | null;
  }>(sql`
    SELECT p.no_order_at, coalesce(u.full_name, p.no_order_by) AS no_order_by_name
    FROM periods p LEFT JOIN users u ON u.sub = p.no_order_by
    WHERE p.ym = ${ymToDate(ym)}::date`);
  const row = rows[0];
  if (!row?.no_order_at) return null;
  return {
    at: new Date(row.no_order_at).toISOString(),
    by_name: row.no_order_by_name,
  };
}

// Mọi đường ghi cờ hoặc tạo bản chốt khóa cùng dòng periods → kỳ không bao giờ vừa có bản vừa có cờ.
// Ghi (không đổi giá trị) thay vì FOR UPDATE: tx REPEATABLE READ đến sau một bản vừa tạo nhận 40001 và làm lại trên ảnh mới (thấy bản đó để dùng lại/replaces)
export async function lockNoOrderFlag(
  tx: Tx,
  ym: string,
): Promise<NoOrderFlag> {
  const { rows } = await tx.execute<{
    no_order_at: Date | string | null;
    no_order_by: string | null;
  }>(sql`
    UPDATE periods SET no_order_at = no_order_at
    WHERE ym = ${ymToDate(ym)}::date
    RETURNING no_order_at, no_order_by`);
  const row = rows[0];
  return {
    no_order_at: row?.no_order_at
      ? new Date(row.no_order_at).toISOString()
      : null,
    no_order_by: row?.no_order_by ?? null,
  };
}

export async function clearNoOrderFlag(
  tx: Tx,
  audit: AuditWriterService,
  ym: string,
  actor: string,
): Promise<boolean> {
  const { rows } = await tx.execute<{
    no_order_at: Date | string;
    no_order_by: string | null;
  }>(sql`
    UPDATE periods p SET no_order_at = NULL, no_order_by = NULL
    FROM periods o
    WHERE p.ym = o.ym AND p.ym = ${ymToDate(ym)}::date AND o.no_order_at IS NOT NULL
    RETURNING o.no_order_at, o.no_order_by`);
  if (!rows[0]) return false;
  await audit.appendWithin(tx, {
    actor,
    action: 'period.no_order_cleared',
    objectType: 'period',
    objectId: ym,
    detail: {
      ym,
      before: {
        no_order_at: new Date(rows[0].no_order_at).toISOString(),
        no_order_by: rows[0].no_order_by,
      },
      after: { no_order_at: null, no_order_by: null },
    },
  });
  return true;
}
