import type { BacklogGroup, BacklogLine, LineDeliveries } from './backlog.api';

export function backlogLine(over: Partial<BacklogLine> = {}): BacklogLine {
  return {
    line_id: 'l-pen',
    request_id: 'r-1',
    period_ym: '2026-10',
    user_sub: 'u-duc',
    full_name: 'Phạm Văn Đức',
    department: 'Tổ Giám sát',
    user_status: 'active',
    item_id: 'i-pen',
    name: 'Bút bi xanh',
    name_en: null,
    unit: 'cay',
    qty: 5,
    delivered_qty: 2,
    cancelled_qty: 0,
    remaining_qty: 3,
    stock_qty: 10,
    counted_in_snapshot_qty: null,
    ...over,
  };
}

export const itemGroup = (lines: BacklogLine[]): BacklogGroup => ({
  key: lines[0].item_id ?? `custom:${lines[0].name}`,
  label: { item_id: lines[0].item_id, name: lines[0].name, unit: lines[0].unit },
  remaining_qty: lines.reduce((s, l) => s + l.remaining_qty, 0),
  lines,
});

export const personGroup = (lines: BacklogLine[], department: string | null = lines[0].department): BacklogGroup => ({
  key: lines[0].user_sub,
  label: { user_sub: lines[0].user_sub, full_name: lines[0].full_name, department },
  remaining_qty: lines.reduce((s, l) => s + l.remaining_qty, 0),
  lines,
});

export function deliveriesOf(over: Partial<LineDeliveries['line']> = {}, items: LineDeliveries['items'] = []): LineDeliveries {
  return {
    line: { id: 'l-pen', qty: 5, delivered_qty: 2, cancelled_qty: 0, cancel_note: null, ...over },
    items,
  };
}
