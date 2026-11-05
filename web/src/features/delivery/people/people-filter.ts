import { matchesSearch } from '@/features/request/request-format';
import { deliverMax } from '../delivery.api';
import type { DeliveryPerson, DeliveryPersonLine } from './delivery-people.api';

export type PeopleTab = 'pending' | 'debt' | 'done' | 'all';

// Có từ khóa thì tìm trên mọi trạng thái: người đứng trước quầy cần thấy ngay dù đã nhận
export function filterPeople(people: DeliveryPerson[], tab: PeopleTab, q: string): DeliveryPerson[] {
  if (q.trim()) return people.filter((p) => matchesSearch(`${p.full_name ?? ''} ${p.department ?? ''}`, q));
  return tab === 'all' ? people : people.filter((p) => p.status === tab);
}

export function tabCounts(people: DeliveryPerson[]): Record<PeopleTab, number> {
  const n: Record<PeopleTab, number> = { pending: 0, debt: 0, done: 0, all: people.length };
  for (const p of people) n[p.status]++;
  return n;
}

// Người khác còn chờ cùng món (kể cả nợ); dòng chờ duyệt chưa tính vì chưa giao được
export function waitingFor(people: DeliveryPerson[], itemId: string, exceptSub: string): { people: number; qty: number } {
  let count = 0;
  let qty = 0;
  for (const p of people) {
    if (p.user_sub === exceptSub) continue;
    const need = p.lines
      .filter((l) => l.item_id === itemId && l.review_status !== 'pending')
      .reduce((s, l) => s + l.remaining_qty, 0);
    if (need > 0) count++;
    qty += need;
  }
  return { people: count, qty };
}

// Trần số giao một dòng: min(còn cần, tủ còn, số server vừa báo); server mới là chuẩn
export function lineMax(line: DeliveryPersonLine, cap?: number): number {
  return deliverMax(line.remaining_qty, line.stock_qty, cap);
}

// Dòng chờ duyệt chưa giao được; dòng đã giao đủ không còn gì để giao
export const isOpenLine = (l: DeliveryPersonLine) => l.review_status !== 'pending' && l.remaining_qty > 0;

export interface PersonPlan {
  give: number;
  need: number;
  short: boolean;
  deliverable: boolean;
}

export function planOf(p: DeliveryPerson): PersonPlan {
  const open = p.lines.filter(isOpenLine);
  return {
    give: open.reduce((s, l) => s + lineMax(l), 0),
    need: open.reduce((s, l) => s + l.remaining_qty, 0),
    short: open.some((l) => lineMax(l) < l.remaining_qty),
    deliverable: open.length > 0,
  };
}
