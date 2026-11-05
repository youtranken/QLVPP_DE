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

export const byPeriod = (a: { period_ym: string }, b: { period_ym: string }) => (a.period_ym < b.period_ym ? -1 : a.period_ym > b.period_ym ? 1 : 0);

export interface Allocated {
  max: number;
  value: number;
  // Dòng trên cùng món đã lấy bớt tồn (max về 0 vì chia tồn, không vì tủ hết)
  taken: boolean;
}

// Tồn thuộc về món, không thuộc dòng: dòng nợ cũ nhất lấy trước, dòng sau chỉ còn phần tồn dư.
// qtys là số người dùng đã chọn (mặc định = trần); chọn ít ở dòng trước thì dòng sau được thêm tồn.
export function allocateLines(
  lines: DeliveryPersonLine[],
  qtys: Record<string, number> = {},
  caps: Record<string, number> = {},
): Record<string, Allocated> {
  const pool = new Map<string, number>();
  const out: Record<string, Allocated> = {};
  const ordered = [...lines].filter(isOpenLine).sort(byPeriod);
  for (const l of ordered) {
    const tracked = l.item_id !== null && l.stock_qty !== null;
    const left = tracked ? (pool.get(l.item_id!) ?? l.stock_qty!) : l.stock_qty;
    const max = lineMax({ ...l, stock_qty: left }, caps[l.line_id]);
    const value = Math.max(0, Math.min(qtys[l.line_id] ?? Infinity, max));
    if (tracked) pool.set(l.item_id!, left! - value);
    out[l.line_id] = { max, value, taken: tracked && left! < l.stock_qty! };
  }
  return out;
}

export interface PersonPlan {
  give: number;
  need: number;
  short: boolean;
  deliverable: boolean;
  shared: boolean;
}

export function planOf(p: DeliveryPerson): PersonPlan {
  const open = p.lines.filter(isOpenLine);
  const alloc = allocateLines(open);
  const items = open.map((l) => l.item_id).filter((i): i is string => i !== null);
  return {
    give: open.reduce((s, l) => s + alloc[l.line_id].value, 0),
    need: open.reduce((s, l) => s + l.remaining_qty, 0),
    short: open.some((l) => alloc[l.line_id].value < l.remaining_qty),
    deliverable: open.length > 0,
    shared: new Set(items).size < items.length,
  };
}
