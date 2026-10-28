import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import type { LineRow, LineSnap } from './request-lines.rules';

export interface RequestHead extends Record<string, unknown> {
  id: string;
  inserted: boolean;
  // null khi client không gửi expected_updated_at
  fresh: boolean | null;
}

export interface RequestRow extends Record<string, unknown> {
  id: string;
  period_ym: string;
  user_sub: string;
  department: string | null;
  updated_at: string;
}

const LINE_COLUMNS = sql.raw(
  `id, item_id, custom_name, custom_unit, custom_note, image_file_id, qty, delivered_qty,
   cancelled_qty, review_status, review_note, added_by_admin`,
);
// Mốc so expected_updated_at và trả cho client cùng độ chính xác mili giây
const UPDATED_AT_ISO = sql.raw(
  `to_char(date_trunc('milliseconds', updated_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
);
const freshness = (expected: string | undefined) =>
  sql`(date_trunc('milliseconds', updated_at) = ${expected ?? null}::timestamptz)`;

// Hai tab lưu lần đầu song song: tx sau chờ tx trước rồi rơi vào DO UPDATE (khóa dòng), không 23505
export async function upsertRequest(
  tx: Executor,
  args: {
    ym: string;
    owner_sub: string;
    department: string | null;
    created_by: string;
    now: Date;
    expected?: string;
  },
): Promise<RequestHead> {
  const { rows } = await tx.execute<RequestHead>(sql`
    INSERT INTO requests (period_ym, user_sub, department, created_by_sub, updated_at)
    VALUES (${ymToDate(args.ym)}::date, ${args.owner_sub}, ${args.department},
            ${args.created_by}, ${args.now.toISOString()}::timestamptz)
    ON CONFLICT (period_ym, user_sub) DO UPDATE SET updated_at = requests.updated_at
    RETURNING id, (xmax = 0) AS inserted, ${freshness(args.expected)} AS fresh
  `);
  return rows[0];
}

export async function lockRequest(
  tx: Executor,
  id: string,
  expected?: string,
): Promise<RequestHead | null> {
  const { rows } = await tx.execute<RequestHead>(sql`
    SELECT id, false AS inserted, ${freshness(expected)} AS fresh
    FROM requests WHERE id = ${id} FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function findRequest(
  ex: Executor,
  where: { id: string } | { ym: string; user_sub: string },
): Promise<RequestRow | null> {
  const cond =
    'id' in where
      ? sql`id = ${where.id}`
      : sql`period_ym = ${ymToDate(where.ym)}::date AND user_sub = ${where.user_sub}`;
  const { rows } = await ex.execute<RequestRow>(sql`
    SELECT id, to_char(period_ym, 'YYYY-MM') AS period_ym, user_sub, department,
           ${UPDATED_AT_ISO} AS updated_at
    FROM requests WHERE ${cond}
  `);
  return rows[0] ?? null;
}

// Khóa theo id tăng dần: cùng thứ tự với giao hàng (requests → request_lines → items)
export async function lockLines(
  tx: Executor,
  requestId: string,
): Promise<LineRow[]> {
  const { rows } = await tx.execute<LineRow & Record<string, unknown>>(sql`
    SELECT ${LINE_COLUMNS} FROM request_lines
    WHERE request_id = ${requestId} ORDER BY id FOR UPDATE
  `);
  return rows;
}

export async function listLines(
  ex: Executor,
  requestId: string,
): Promise<LineRow[]> {
  const { rows } = await ex.execute<LineRow & Record<string, unknown>>(sql`
    SELECT ${LINE_COLUMNS} FROM request_lines
    WHERE request_id = ${requestId} ORDER BY created_at, id
  `);
  return rows;
}

export async function insertLine(
  tx: Executor,
  requestId: string,
  line: {
    snap: LineSnap;
    review_status: string;
    added_by_admin: boolean;
    now: Date;
  },
): Promise<string> {
  const s = line.snap;
  // clock_timestamp: các dòng chèn cùng tx vẫn giữ thứ tự người dùng nhập khi hiển thị
  const { rows } = await tx.execute<{ id: string }>(sql`
    INSERT INTO request_lines (request_id, item_id, custom_name, custom_unit, custom_note,
                               image_file_id, qty, review_status, added_by_admin,
                               created_at, updated_at)
    VALUES (${requestId}, ${s.item_id}, ${s.custom_name}, ${s.custom_unit}, ${s.custom_note},
            ${s.image_file_id}, ${s.qty}, ${line.review_status}, ${line.added_by_admin},
            clock_timestamp(), ${line.now.toISOString()}::timestamptz)
    RETURNING id
  `);
  return rows[0].id;
}

export async function updateLine(
  tx: Executor,
  id: string,
  s: LineSnap,
  now: Date,
): Promise<void> {
  await tx.execute(sql`
    UPDATE request_lines
    SET custom_name = ${s.custom_name}, custom_unit = ${s.custom_unit},
        custom_note = ${s.custom_note}, image_file_id = ${s.image_file_id}, qty = ${s.qty},
        updated_at = ${now.toISOString()}::timestamptz
    WHERE id = ${id}
  `);
}

export async function deleteLines(tx: Executor, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await tx.execute(sql`
    DELETE FROM request_lines WHERE id = ANY(${sql.param(ids)}::uuid[])
  `);
}

// GREATEST: hai lần lưu trong cùng mili giây (hoặc đồng hồ test đứng yên) vẫn đổi updated_at → STALE_UPDATE còn tác dụng
const nextUpdatedAt = (now: Date) =>
  sql`GREATEST(${now.toISOString()}::timestamptz,
               date_trunc('milliseconds', updated_at) + interval '1 millisecond')`;

export async function touchRequest(
  tx: Executor,
  id: string,
  now: Date,
  department: string | null,
): Promise<void> {
  await tx.execute(sql`
    UPDATE requests
    SET updated_at = ${nextUpdatedAt(now)}, department = ${department}
    WHERE id = ${id}
  `);
}

export async function deleteRequest(tx: Executor, id: string): Promise<void> {
  await tx.execute(sql`DELETE FROM requests WHERE id = ${id}`);
}

export async function hasItemLines(
  ex: Executor,
  itemId: string,
): Promise<boolean> {
  const { rows } = await ex.execute(sql`
    SELECT 1 FROM request_lines WHERE item_id = ${itemId} LIMIT 1
  `);
  return rows.length > 0;
}

// Nguồn chép lại: phiếu gần nhất trước kỳ đang mở (bỏ qua tháng trống)
export async function findLatestBefore(
  ex: Executor,
  userSub: string,
  ym: string,
): Promise<{ id: string; period_ym: string } | null> {
  const { rows } = await ex.execute<{ id: string; period_ym: string }>(sql`
    SELECT id, to_char(period_ym, 'YYYY-MM') AS period_ym FROM requests
    WHERE user_sub = ${userSub} AND period_ym < ${ymToDate(ym)}::date
    ORDER BY period_ym DESC LIMIT 1
  `);
  return rows[0] ?? null;
}

// Ảnh line_image đã gắn vào dòng nào đó của chính chủ phiếu (kể cả ảnh Hành chính thay) → chủ phiếu dùng lại được
export async function imagesOnOwnerLines(
  ex: Executor,
  fileIds: string[],
  ownerSub: string,
): Promise<Set<string>> {
  if (fileIds.length === 0) return new Set();
  const { rows } = await ex.execute<{ id: string }>(sql`
    SELECT DISTINCT f.id FROM files f
    JOIN request_lines l ON l.image_file_id = f.id
    JOIN requests r ON r.id = l.request_id
    WHERE f.id = ANY(${sql.param(fileIds)}::uuid[])
      AND f.purpose = 'line_image' AND r.user_sub = ${ownerSub}
  `);
  return new Set(rows.map((r) => r.id));
}

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

// Dòng đổi trạng thái = phiếu đổi: tab đang mở với mốc cũ phải nhận STALE_UPDATE
export async function bumpRequest(
  tx: Executor,
  id: string,
  now: Date,
): Promise<string> {
  const { rows } = await tx.execute<{ updated_at: string }>(sql`
    UPDATE requests
    SET updated_at = ${nextUpdatedAt(now)}
    WHERE id = ${id} RETURNING ${UPDATED_AT_ISO} AS updated_at
  `);
  return rows[0].updated_at;
}
