import type { DeliveryPerson, DeliveryPersonLine } from './delivery-people.api';
import { isOpenLine } from './people-filter';

export interface PlanLine {
  line_id: string;
  user_sub: string;
  key: string;
  period_ym: string;
  request_at: string;
  line_at: string;
  remaining: number;
  active: boolean;
}

export interface Priority {
  suggest: number;
  cap: number;
  ahead_qty: number;
  ahead_people: number;
}

type Ordered = Pick<PlanLine, 'period_ym' | 'request_at' | 'line_at' | 'line_id'>;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const byRegistration = (a: Ordered, b: Ordered) =>
  cmp(a.period_ym, b.period_ym) || cmp(a.request_at, b.request_at) || cmp(a.line_at, b.line_at) || cmp(a.line_id, b.line_id);

// Tủ không đủ cho mọi người chờ: ai đăng ký trước được giữ phần trước; người đã nghỉ gợi ý 0 và không giữ tủ của ai
export function allocateWithPriority(lines: PlanLine[], stock: Map<string, number>): Map<string, Priority> {
  const out = new Map<string, Priority>();
  const byKey = new Map<string, PlanLine[]>();
  for (const l of lines) if (stock.has(l.key)) byKey.set(l.key, [...(byKey.get(l.key) ?? []), l]);
  for (const [key, group] of byKey) {
    const s = Math.max(0, stock.get(key) ?? 0);
    let ahead = 0;
    const before = new Set<string>();
    for (const l of [...group].sort(byRegistration)) {
      const others = [...before].filter((u) => u !== l.user_sub).length;
      const suggest = l.active ? Math.min(l.remaining, Math.max(0, s - ahead)) : 0;
      out.set(l.line_id, { suggest, cap: Math.min(l.remaining, s), ahead_qty: ahead, ahead_people: others });
      if (!l.active) continue;
      ahead += l.remaining;
      before.add(l.user_sub);
    }
  }
  return out;
}

const isActive = (p: DeliveryPerson) => p.user_status === 'active';

function planLinesOf(people: DeliveryPerson[]): PlanLine[] {
  return people.flatMap((p) =>
    p.lines
      .filter((l) => isOpenLine(l) && l.item_id !== null && l.stock_qty !== null)
      .map((l) => ({ ...l, key: l.item_id!, user_sub: p.user_sub, remaining: l.remaining_qty, active: isActive(p) })),
  );
}

function stockOf(people: DeliveryPerson[]): Map<string, number> {
  const stock = new Map<string, number>();
  for (const l of people.flatMap((p) => p.lines)) if (l.item_id !== null && l.stock_qty !== null) stock.set(l.item_id, l.stock_qty);
  return stock;
}

export const priorityOf = (people: DeliveryPerson[]) => allocateWithPriority(planLinesOf(people), stockOf(people));

// Người đang giao luôn có trong tập tính ưu tiên, với dữ liệu mới nhất của chính họ
export const priorityFor = (person: DeliveryPerson, people: DeliveryPerson[]) =>
  priorityOf([...people.filter((p) => p.user_sub !== person.user_sub), person]);

export interface Shortage {
  s: number;
  k: number;
  q: number;
  short: number;
}

// Món mà tủ ít hơn tổng người (còn làm) đang chờ
export function stockShortages(people: DeliveryPerson[]): Map<string, Shortage> {
  const stock = stockOf(people);
  const waiting = new Map<string, { subs: Set<string>; q: number }>();
  for (const l of planLinesOf(people).filter((x) => x.active)) {
    const w = waiting.get(l.key) ?? { subs: new Set<string>(), q: 0 };
    w.subs.add(l.user_sub);
    w.q += l.remaining;
    waiting.set(l.key, w);
  }
  const out = new Map<string, Shortage>();
  for (const [key, w] of waiting) {
    const s = Math.max(0, stock.get(key) ?? 0);
    if (s < w.q) out.set(key, { s, k: w.subs.size, q: w.q, short: w.q - s });
  }
  return out;
}

export type RowKind = 'give' | 'adm' | 'skip';

export interface DialogRow {
  line: DeliveryPersonLine;
  kind: RowKind;
  reason?: 'review' | 'stock';
  suggest: number;
  // "Giữ k cho m người đăng ký trước" khi phần giữ làm gợi ý nhỏ hơn trần
  held: { k: number; m: number } | null;
  // Tủ còn cho dòng này sau phần giữ cho người trước (nhãn ADM hết hàng)
  stockLeft: number;
}

const customCap = (l: DeliveryPersonLine) => Math.max(0, Math.min(l.remaining_qty, l.deliver_cap ?? l.remaining_qty));

function rowOf(l: DeliveryPersonLine, active: boolean, pr: Priority | undefined): DialogRow {
  if (l.review_status === 'pending') return { line: l, kind: 'skip', reason: 'review', suggest: 0, held: null, stockLeft: 0 };
  const catalog = l.item_id !== null && l.stock_qty !== null;
  const cap = catalog ? (pr?.cap ?? 0) : customCap(l);
  const suggest = !active ? 0 : catalog ? (pr?.suggest ?? 0) : cap;
  const stockLeft = catalog ? Math.max(0, l.stock_qty! - (pr?.ahead_qty ?? 0)) : cap;
  const held = catalog && pr && pr.ahead_people > 0 && suggest < cap ? { k: Math.min(l.stock_qty!, pr.ahead_qty), m: pr.ahead_people } : null;
  if (l.adm_out) return { line: l, kind: 'adm', suggest, held, stockLeft };
  if (cap === 0) return { line: l, kind: 'skip', reason: 'stock', suggest: 0, held: null, stockLeft };
  return { line: l, kind: 'give', suggest, held, stockLeft };
}

// Thứ tự hàng trong hộp cũng là thứ tự gửi: nợ trước (kỳ cũ nhất trước), rồi kỳ này
export function dialogRows(person: DeliveryPerson, priority: Map<string, Priority>): DialogRow[] {
  const ordered = person.lines.filter((l) => l.remaining_qty > 0).sort((a, b) => Number(b.is_debt) - Number(a.is_debt) || byRegistration(a, b));
  return ordered.map((l) => rowOf(l, isActive(person), priority.get(l.line_id)));
}

export interface Limit {
  cap: number;
  value: number;
  // Trần về 0 vì dòng trên cùng món đã lấy tồn, không phải vì tủ hết
  taken: boolean;
}

// Tồn thuộc về món: dòng trên lấy trước, hạ dòng trên thì dòng dưới được thêm
export function limitsOf(rows: DialogRow[], values: Record<string, number>): Record<string, Limit> {
  const pool = new Map<string, number>();
  const out: Record<string, Limit> = {};
  for (const r of rows) {
    const l = r.line;
    if (r.kind === 'skip') {
      out[l.line_id] = { cap: 0, value: 0, taken: false };
      continue;
    }
    const catalog = l.item_id !== null && l.stock_qty !== null;
    const left = catalog ? (pool.get(l.item_id!) ?? l.stock_qty!) : customCap(l);
    const cap = Math.max(0, Math.min(l.remaining_qty, left));
    const value = Math.max(0, Math.min(values[l.line_id] ?? r.suggest, cap));
    if (catalog) pool.set(l.item_id!, left - value);
    out[l.line_id] = { cap, value, taken: catalog && left < l.stock_qty! };
  }
  return out;
}

export interface Totals {
  give: number;
  left: number;
  debt: number;
  cancel: number;
}

export function totalsOf(rows: DialogRow[], lim: Record<string, Limit>): Totals {
  const t: Totals = { give: 0, left: 0, debt: 0, cancel: 0 };
  for (const r of rows) {
    if (r.reason === 'review') continue;
    const value = lim[r.line.line_id]?.value ?? 0;
    const rest = r.line.remaining_qty - value;
    t.give += value;
    if (r.kind === 'adm') t.cancel += rest > 0 ? 1 : 0;
    else if (r.line.is_debt) t.debt += rest;
    else t.left += rest;
  }
  return t;
}

export type Step =
  | { kind: 'deliver'; line: DeliveryPersonLine; qty: number }
  | { kind: 'cancel'; line: DeliveryPersonLine; expectedDelivered: number };

// Giao hết các dòng trước, rồi mới hủy phần thiếu của dòng ADM hết hàng
export function stepsOf(rows: DialogRow[], lim: Record<string, Limit>): Step[] {
  const value = (r: DialogRow) => lim[r.line.line_id]?.value ?? 0;
  const delivers: Step[] = rows.filter((r) => r.kind !== 'skip' && value(r) > 0).map((r) => ({ kind: 'deliver', line: r.line, qty: value(r) }));
  const cancels: Step[] = rows
    .filter((r) => r.kind === 'adm' && r.line.remaining_qty - value(r) > 0)
    .map((r) => ({ kind: 'cancel', line: r.line, expectedDelivered: r.line.delivered_qty + value(r) }));
  return [...delivers, ...cancels];
}
