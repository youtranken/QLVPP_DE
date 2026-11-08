import type { BulkDeliverBody, DeliveryPerson } from './delivery-people.api';
import { dialogRows, limitsOf, priorityOf } from './deliver-plan';

export interface BulkSummary {
  user_sub: string;
  // Số món và đơn vị sẽ giao; left = phần còn lại của các dòng đó sau lần này (chờ hàng về / thành Còn nợ)
  items: number;
  give: number;
  left: number;
}

export interface BulkPlan {
  body: BulkDeliverBody;
  skipped: { user_sub: string; reason: 'nothing' }[];
  summary: BulkSummary[];
  // request_id → người, để ghép kết quả từng phiếu với tên
  owners: Record<string, string>;
}

// Số giao của từng dòng đúng như hộp giao từng người: gợi ý theo thứ tự đăng ký (allocateWithPriority) rồi kẹp theo tủ (limitsOf).
// Chỉ dòng "giao được" (kind give); dòng ADM hết hàng cần hủy phần thiếu nên để hộp giao từng người xử lý — giao nhiều phiếu không hủy gì.
export function bulkPlan(selected: DeliveryPerson[], people: DeliveryPerson[]): BulkPlan {
  const priority = priorityOf(people);
  const plan: BulkPlan = { body: { requests: [] }, skipped: [], summary: [], owners: {} };
  for (const p of selected) {
    const rows = dialogRows(p, priority).filter((r) => r.kind === 'give');
    const lim = limitsOf(rows, Object.fromEntries(rows.map((r) => [r.line.line_id, r.suggest])));
    const given = rows.filter((r) => (lim[r.line.line_id]?.value ?? 0) > 0);
    if (given.length === 0) {
      plan.skipped.push({ user_sub: p.user_sub, reason: 'nothing' });
      continue;
    }
    const byRequest = new Map<string, BulkDeliverBody['requests'][number]>();
    for (const r of given) {
      const entry = byRequest.get(r.line.request_id) ?? { request_id: r.line.request_id, lines: [] };
      entry.lines.push({ line_id: r.line.line_id, qty: lim[r.line.line_id].value, expected_delivered_qty: r.line.delivered_qty });
      byRequest.set(r.line.request_id, entry);
      plan.owners[r.line.request_id] = p.user_sub;
    }
    plan.body.requests.push(...byRequest.values());
    const give = given.reduce((n, r) => n + lim[r.line.line_id].value, 0);
    plan.summary.push({
      user_sub: p.user_sub,
      items: new Set(given.map((r) => r.line.item_id ?? r.line.name)).size,
      give,
      left: given.reduce((n, r) => n + r.line.remaining_qty - lim[r.line.line_id].value, 0),
    });
  }
  return plan;
}
