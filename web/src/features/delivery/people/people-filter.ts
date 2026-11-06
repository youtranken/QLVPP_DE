import { matchesSearch } from '@/features/request/request-format';
import type { DeliveryPerson, DeliveryPersonLine } from './delivery-people.api';

export type PeopleTab = 'pending' | 'debt' | 'done' | 'all';

// Tab theo cờ chứ không theo status: người vừa chưa nhận vừa còn nợ có ở cả hai tab
const IN_TAB: Record<PeopleTab, (p: DeliveryPerson) => boolean> = {
  pending: (p) => p.has_pending,
  debt: (p) => p.has_debt,
  done: (p) => !p.has_pending && !p.has_debt,
  all: () => true,
};

// Có từ khóa thì tìm trên mọi trạng thái: người đứng trước quầy cần thấy ngay dù đã nhận
export function filterPeople(people: DeliveryPerson[], tab: PeopleTab, q: string): DeliveryPerson[] {
  if (q.trim()) return people.filter((p) => matchesSearch(`${p.full_name ?? ''} ${p.department ?? ''}`, q));
  return people.filter(IN_TAB[tab]);
}

export function tabCounts(people: DeliveryPerson[]): Record<PeopleTab, number> {
  const count = (tab: PeopleTab) => people.filter(IN_TAB[tab]).length;
  return { pending: count('pending'), debt: count('debt'), done: count('done'), all: people.length };
}

export const overlapCount = (people: DeliveryPerson[]) => people.filter((p) => p.has_pending && p.has_debt).length;

export interface Waiting {
  people: number;
  qty: number;
}

// Chỉ mục món → số cần của từng người, dựng một lần cho cả danh sách; dòng chờ duyệt chưa tính vì chưa giao được
export function waitingIndex(people: DeliveryPerson[]): (itemId: string, exceptSub: string) => Waiting {
  const byItem = new Map<string, Map<string, number>>();
  for (const p of people) {
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

// Số trên thẻ: dòng chưa nhận + nợ còn giao được (bỏ dòng chờ duyệt)
export function cardSummary(p: DeliveryPerson): { n: number; u: number } {
  const open = p.lines.filter(isOpenLine);
  return { n: open.length, u: open.reduce((s, l) => s + l.remaining_qty, 0) };
}
