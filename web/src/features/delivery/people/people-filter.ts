import type { DeliveryPerson, DeliveryPersonLine } from './delivery-people.api';

export interface Waiting {
  people: number;
  qty: number;
}

// Chỉ mục món → số cần của từng người, dựng một lần cho cả danh sách; dòng chờ duyệt chưa tính vì chưa giao được.
// Người đã nghỉ không giữ phần nào (như W19) nên không tính là người đang chờ
export function waitingIndex(people: DeliveryPerson[]): (itemId: string, exceptSub: string) => Waiting {
  const byItem = new Map<string, Map<string, number>>();
  for (const p of people) {
    if (p.user_status !== 'active') continue;
    for (const l of p.lines) {
      if (!l.item_id || l.review_status === 'pending' || l.remaining_qty <= 0) continue;
      const bySub = byItem.get(l.item_id) ?? new Map<string, number>();
      bySub.set(p.user_sub, (bySub.get(p.user_sub) ?? 0) + l.remaining_qty);
      byItem.set(l.item_id, bySub);
    }
  }
  return (itemId, exceptSub) => {
    let count = 0;
    let qty = 0;
    for (const [sub, need] of byItem.get(itemId) ?? []) {
      if (sub === exceptSub) continue;
      count++;
      qty += need;
    }
    return { people: count, qty };
  };
}

// Người khác còn chờ cùng món (kể cả nợ)
export const waitingFor = (people: DeliveryPerson[], itemId: string, exceptSub: string): Waiting => waitingIndex(people)(itemId, exceptSub);

// Dòng chờ duyệt chưa giao được; dòng đã giao đủ không còn gì để giao
export const isOpenLine = (l: DeliveryPersonLine) => l.review_status !== 'pending' && l.remaining_qty > 0;

// Cùng khóa gộp món ngoài DM của server (CUSTOM_ITEM_KEY: tên + ĐVT trim, không phân biệt hoa thường)
const itemKeyOf = (l: DeliveryPersonLine) =>
  l.item_id ?? `custom:${JSON.stringify([l.name.trim().toLowerCase(), l.unit.trim().toLowerCase()])}`;

// Số trên thẻ: số món (nợ + kỳ này cùng món là một) và đơn vị còn giao được (bỏ dòng chờ duyệt)
export function cardSummary(p: DeliveryPerson): { n: number; u: number } {
  const open = p.lines.filter(isOpenLine);
  const items = new Set(open.map(itemKeyOf));
  return { n: items.size, u: open.reduce((s, l) => s + l.remaining_qty, 0) };
}
