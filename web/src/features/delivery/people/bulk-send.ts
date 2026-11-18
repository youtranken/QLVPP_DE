import type { BulkPlan } from './bulk-plan';
import { NOT_SENT } from './deliver-send';
import { BULK_MAX_REQUESTS, deliverBulk, type BulkDeliverBody, type BulkRequestResult } from './delivery-people.api';
import { REJECT_SKIPPED, withRejects } from './with-rejects';

type Entry = BulkDeliverBody['requests'][number];

export interface BulkSent {
  entry: Entry;
  result: BulkRequestResult;
  // Số món chờ duyệt không ghi Không mua vì người đó đã có phiếu giao lỗi
  skippedRejects: number;
}

export interface BulkOutcome {
  sent: BulkSent[];
  error: unknown;
  // Id hoàn tác của từng lô; null khi có lô server không mở hoàn tác (kèm ghi Không mua) — không hoàn tác dở
  undoIds: string[] | null;
}

// Gửi theo đúng thứ tự gói (người, rồi phiếu nợ trước), lô ≤ BULK_MAX_REQUESTS. Mục mang reject_line_ids chỉ gửi kèm
// khi các phiếu trước của cùng người đã có kết quả và đều thành công — gửi dở lô đó trước nếu cần; có phiếu lỗi thì bỏ phần Không mua
export async function sendBulk(plan: BulkPlan, csrfToken: string | null): Promise<BulkOutcome> {
  const ownerOf = (id: string) => plan.owners[id];
  const entries = withRejects(plan.body.requests, plan.pending, (id) => ({ request_id: id, lines: [] }), ownerOf);
  const sent: BulkSent[] = [];
  let undoIds: string[] | null = [];
  const failedOwners = new Set<string>();
  let batch: Omit<BulkSent, 'result'>[] = [];
  const flush = async () => {
    if (batch.length === 0) return;
    const cur = batch;
    batch = [];
    const { results, undo_id } = await deliverBulk({ requests: cur.map((b) => b.entry) }, csrfToken);
    const delivered = results.some((r) => r.ok && r.delivered_units > 0);
    if (delivered) undoIds = undo_id && undoIds ? [...undoIds, undo_id] : null;
    for (const b of cur) {
      const result = results.find((r) => r.request_id === b.entry.request_id) ?? { request_id: b.entry.request_id, ok: false as const, code: 'UNKNOWN' };
      sent.push({ ...b, result });
      if (!result.ok) failedOwners.add(ownerOf(result.request_id));
    }
  };
  try {
    for (const entry of entries) {
      const owner = ownerOf(entry.request_id);
      let next: Omit<BulkSent, 'result'> = { entry, skippedRejects: 0 };
      if (entry.reject_line_ids) {
        if (batch.some((b) => ownerOf(b.entry.request_id) === owner)) await flush();
        if (failedOwners.has(owner)) {
          const { reject_line_ids, ...rest } = entry;
          next = { entry: rest, skippedRejects: reject_line_ids.length };
          if (rest.lines.length === 0) {
            sent.push({ ...next, result: { request_id: entry.request_id, ok: false, code: REJECT_SKIPPED } });
            continue;
          }
        }
      }
      batch.push(next);
      if (batch.length === BULK_MAX_REQUESTS) await flush();
    }
    await flush();
    return { sent, error: null, undoIds: undoIds?.length ? undoIds : null };
  } catch (error) {
    const done = new Set(sent.map((s) => s.entry.request_id));
    for (const entry of entries) {
      if (!done.has(entry.request_id)) sent.push({ entry, skippedRejects: 0, result: { request_id: entry.request_id, ok: false, code: NOT_SENT } });
    }
    return { sent, error, undoIds: null };
  }
}

export interface PersonResult {
  user_sub: string;
  ok: boolean;
  units: number;
  rejected: number;
  skippedRejects: number;
  failures: Extract<BulkRequestResult, { ok: false }>[];
}

// Một dòng kết quả mỗi người: gộp phiếu nợ, phiếu tháng này và phiếu chỉ ghi Không mua
export function byPerson(sent: BulkSent[], owners: Record<string, string>): PersonResult[] {
  const rows = new Map<string, PersonResult>();
  for (const s of sent) {
    const sub = owners[s.entry.request_id];
    const row = rows.get(sub) ?? { user_sub: sub, ok: true, units: 0, rejected: 0, skippedRejects: 0, failures: [] };
    rows.set(sub, row);
    row.skippedRejects += s.skippedRejects;
    if (s.result.ok) {
      row.units += s.result.delivered_units;
      row.rejected += s.entry.reject_line_ids?.length ?? 0;
    } else {
      row.ok = false;
      if (s.result.code !== REJECT_SKIPPED) row.failures.push(s.result);
    }
  }
  return [...rows.values()];
}
