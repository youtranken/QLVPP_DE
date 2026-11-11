import { ConflictException, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Executor } from '../../database/database.module';
import type { SnapshotData, SnapshotRef } from './report.types';

// Bản chốt có hàng: bản rỗng cũ không bao giờ là "bản mới nhất"
export const hasItemsSql = sql.raw(
  `EXISTS (SELECT 1 FROM jsonb_each_text(data->'order_qty') e WHERE e.value::int > 0)`,
);

export interface OrderTotals {
  items_count: number;
  units_total: number;
}

export interface SentSnapshot extends OrderTotals {
  id: string;
  kind: string;
  created_at: string;
  replaces: SnapshotRef | null;
  data: SnapshotData;
}

export function orderTotals(orderQty: Record<string, number>): OrderTotals {
  const qty = Object.values(orderQty).filter((n) => n > 0);
  return {
    items_count: qty.length,
    units_total: qty.reduce((a, b) => a + b, 0),
  };
}

// Mọi `kind` khi không truyền; cùng created_at thì id lớn hơn là mới hơn
export async function latestSent(
  ex: Executor,
  ym: string,
  kind?: string,
): Promise<SentSnapshot | null> {
  const { rows } = await ex.execute<{
    id: string;
    kind: string;
    created_at: Date | string;
    data: SnapshotData;
  }>(sql`
    SELECT id, kind, created_at, data FROM report_snapshots
    WHERE period_ym = ${ymToDate(ym)}::date AND ${hasItemsSql}
      AND (${kind ?? null}::text IS NULL OR kind = ${kind ?? null})
    ORDER BY created_at DESC, id DESC LIMIT 1`);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    created_at: new Date(row.created_at).toISOString(),
    ...orderTotals(row.data.order_qty),
    replaces: row.data.replaces ?? null,
    data: row.data,
  };
}

export function noSentSnapshot(): NotFoundException {
  return new NotFoundException({
    code: 'NO_SENT_SNAPSHOT',
    message: 'Kỳ này chưa có bản chốt nào có món.',
  });
}

// Nhận hàng của kỳ khi chưa có bản gửi NCC (chưa chốt, hoặc "Không cần đề nghị"): hàng nào về cũng không khớp đơn nào
export function reportNotSent(ym: string): ConflictException {
  return new ConflictException({
    code: 'REPORT_NOT_SENT',
    message:
      'Chưa gửi NCC báo cáo kỳ này — vào Báo cáo & gửi NCC để chốt trước khi nhận hàng.',
    ym,
  });
}

export function orderEmpty(): ConflictException {
  return new ConflictException({
    code: 'ORDER_EMPTY',
    message: 'Chưa có món nào để đề nghị.',
  });
}

export function orderNotEmpty(): ConflictException {
  return new ConflictException({
    code: 'ORDER_NOT_EMPTY',
    message:
      'Còn món có số đề nghị — hãy In trình ký thay vì đánh dấu không cần đề nghị.',
  });
}

export function alreadySent(): ConflictException {
  return new ConflictException({
    code: 'ALREADY_SENT',
    message: 'Kỳ này đã có bản gửi NCC.',
  });
}

const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
        )
      : v;

// Mốc giờ, người lập, dòng thay thế không phải số liệu; còn lại khác một chữ là bản khác
const VOLATILE = ['generated_at', 'created_at', 'created_by', 'replaces'];

export function sameContent(a: object, b: object): boolean {
  const strip = (d: object) =>
    Object.fromEntries(
      Object.entries(d).filter(([k]) => !VOLATILE.includes(k)),
    );
  return (
    JSON.stringify(canonical(strip(a))) === JSON.stringify(canonical(strip(b)))
  );
}

// Ô 0 và ô vắng như nhau: bản thay thế chỉ khi số đặt ADM khác
export function sameOrder(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const positive = (o: Record<string, number>) =>
    Object.entries(o)
      .filter(([, n]) => n > 0)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return JSON.stringify(positive(a)) === JSON.stringify(positive(b));
}
