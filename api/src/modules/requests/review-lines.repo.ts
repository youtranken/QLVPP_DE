import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import type { LineRow } from './request-lines.rules';
import { LINE_COLUMNS } from './requests.repo';

// Câu SQL của duyệt món ngoài danh mục: khóa và ghi trạng thái duyệt của dòng
// Review: khóa phiếu trước rồi dòng — cùng thứ tự với writer (requests → request_lines)
export async function lockLineForReview(
  tx: Executor,
  lineId: string,
): Promise<(LineRow & { request_id: string }) | null> {
  const head = await tx.execute<{ id: string }>(sql`
    SELECT r.id FROM requests r JOIN request_lines l ON l.request_id = r.id
    WHERE l.id = ${lineId} FOR UPDATE OF r
  `);
  if (head.rows.length === 0) return null;
  const { rows } = await tx.execute<
    LineRow & { request_id: string } & Record<string, unknown>
  >(sql`
    SELECT ${LINE_COLUMNS}, request_id FROM request_lines WHERE id = ${lineId} FOR UPDATE
  `);
  return rows[0] ?? null;
}

// itemId có → convert: CHECK request_lines_item_review_ck đòi custom_* NULL khi có item_id, ảnh giữ lại
export async function setReview(
  tx: Executor,
  lineId: string,
  r: {
    status: string;
    note: string | null;
    itemId: string | null;
    by: string;
    now: Date;
  },
): Promise<LineRow | null> {
  const at = r.now.toISOString();
  const { rows } = await tx.execute<LineRow & Record<string, unknown>>(sql`
    UPDATE request_lines
    SET review_status = ${r.status}, review_note = ${r.note},
        item_id = coalesce(${r.itemId}::uuid, item_id),
        custom_name = CASE WHEN ${r.itemId}::uuid IS NULL THEN custom_name END,
        custom_unit = CASE WHEN ${r.itemId}::uuid IS NULL THEN custom_unit END,
        custom_note = CASE WHEN ${r.itemId}::uuid IS NULL THEN custom_note END,
        reviewed_by_sub = ${r.by}, reviewed_at = ${at}::timestamptz,
        updated_at = ${at}::timestamptz
    WHERE id = ${lineId} AND review_status = 'pending'
    RETURNING ${LINE_COLUMNS}
  `);
  return rows[0] ?? null;
}

// Đọc đủ cột (cho audit) của các dòng người gọi đã khóa và đã kiểm còn chờ
export async function linesOf(
  tx: Executor,
  requestId: string,
  lineIds: string[],
): Promise<(LineRow & { request_id: string })[]> {
  const { rows } = await tx.execute<
    LineRow & { request_id: string } & Record<string, unknown>
  >(sql`
    SELECT ${LINE_COLUMNS}, request_id FROM request_lines
    WHERE request_id = ${requestId} AND id = ANY(${sql.param(lineIds)}::uuid[])
    ORDER BY id`);
  return rows;
}

// Dòng ngoài danh mục còn chờ của kỳ, khóa requests → request_lines theo id (cùng chiều mọi đường ghi)
export async function lockPendingLines(
  tx: Executor,
  ym: string,
): Promise<(LineRow & { request_id: string })[]> {
  const k = ymToDate(ym);
  const locked = await tx.execute<{ id: string } & Record<string, unknown>>(sql`
    SELECT r.id FROM requests r
    WHERE r.period_ym = ${k}::date AND EXISTS (
      SELECT 1 FROM request_lines l WHERE l.request_id = r.id AND l.review_status = 'pending')
    ORDER BY r.id FOR UPDATE`);
  const ids = locked.rows.map((r) => r.id);
  if (ids.length === 0) return [];
  // Chỉ dòng của đúng các phiếu vừa khóa: giữ thứ tự khóa requests → request_lines
  const { rows } = await tx.execute<
    LineRow & { request_id: string } & Record<string, unknown>
  >(sql`
    SELECT ${LINE_COLUMNS}, request_id FROM request_lines
    WHERE review_status = 'pending' AND request_id = ANY(${sql.param(ids)}::uuid[])
    ORDER BY id FOR UPDATE`);
  return rows;
}
