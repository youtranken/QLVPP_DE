import { matches } from '@/lib/search';
import type { AdminItem } from '@/features/catalog/catalog.api';
import type { ArrivalsPlan } from './arrivals.api';

export const ARRIVAL_QTY_MAX = 99999;
export const NO_GROUP = 'none';

export interface ArrivalRow {
  item_id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  category_id: string | null;
  image_file_id: string | null;
  ordered: number;
  received: number;
  remaining: number;
  stock: number;
  usable: boolean;
  // Món ngừng vẫn có trong bản in: ngừng riêng hay theo nhóm
  inactive_reason: 'item' | 'category' | null;
  adm_out: boolean;
  adm_out_final: boolean;
  reduced: number;
  // Thêm bằng "Thêm món khác": không có trong bản in
  added: boolean;
}

export interface ArrivalSection {
  id: string;
  label: string;
  // Hàng đang hiện (sau lọc) và mọi hàng của nhóm (đếm "đã về đủ", điền cả nhóm)
  rows: ArrivalRow[];
  all: ArrivalRow[];
}

export function toArrivalRows(plan: ArrivalsPlan, added: AdminItem[]): ArrivalRow[] {
  const rows: ArrivalRow[] = plan.rows.map((r) => ({
    item_id: r.item_id,
    code: r.code,
    name: r.name,
    name_en: r.name_en,
    unit: r.unit,
    category_id: r.category_id,
    image_file_id: r.image_file_id,
    ordered: r.ordered,
    received: r.received,
    remaining: r.remaining,
    stock: r.stock_qty,
    usable: r.usable,
    inactive_reason: r.inactive_reason,
    adm_out: r.adm_out,
    adm_out_final: r.adm_out_final,
    reduced: r.reduced_after_snapshot,
    added: false,
  }));
  const known = new Set(rows.map((r) => r.item_id));
  for (const i of added) {
    if (known.has(i.id)) continue;
    known.add(i.id);
    rows.push({
      item_id: i.id,
      code: i.code,
      name: i.name,
      name_en: i.name_en,
      unit: i.unit,
      category_id: i.category_id,
      image_file_id: i.image_file_id,
      ordered: 0,
      received: 0,
      remaining: 0,
      stock: i.stock_qty,
      usable: true,
      inactive_reason: null,
      adm_out: false,
      adm_out_final: false,
      reduced: 0,
      added: true,
    });
  }
  return rows;
}

// Đã nhận đủ theo Đề nghị mua: khóa ô ở UI (sai thì chỉnh ở Tủ / Kho); server vẫn cho nhận dư
export const isReceivedFull = (r: ArrivalRow) => !r.added && r.ordered > 0 && r.received >= r.ordered;

export const prefillOf = (r: ArrivalRow) => (r.adm_out || r.added || isReceivedFull(r) ? 0 : r.remaining);

// Dòng còn nhận được: không ADM hết hàng, chưa nhận đủ
export const isReceivable = (r: ArrivalRow) => !r.adm_out && !isReceivedFull(r);

// Dòng gửi khi bấm "Nhận đủ hàng": ô chưa gõ = phần còn thiếu, ô đã gõ = đúng số, ADM hết hàng và dòng khóa bỏ qua
export const receivableLines = (rows: ArrivalRow[], qtyOf: (r: ArrivalRow) => number) =>
  rows.filter((r) => isReceivable(r) && qtyOf(r) > 0).map((row) => ({ row, qty: qtyOf(row) }));

// Món ngừng đã đặt vẫn chờ về như món thường (đã đặt thì phải nhận)
export const isShort = (r: ArrivalRow) => !r.adm_out && r.received < r.ordered;

export const groupOf = (r: Pick<ArrivalRow, 'category_id'>, known: ReadonlySet<string>) =>
  r.category_id && known.has(r.category_id) ? r.category_id : NO_GROUP;

export interface ArrivalFilter {
  q: string;
  g: string | null;
  short: boolean;
}

export const parseArrivalFilter = (p: URLSearchParams): ArrivalFilter => ({
  q: (p.get('q') ?? '').trim(),
  g: p.get('g'),
  short: p.get('short') === '1',
});

export const isFiltering = (f: ArrivalFilter) => f.q !== '' || f.g !== null || f.short;

export function applyArrivalFilter(rows: ArrivalRow[], f: ArrivalFilter, known: ReadonlySet<string>): ArrivalRow[] {
  return rows.filter((r) => (!f.g || groupOf(r, known) === f.g) && (!f.short || isShort(r)) && matches(r, f.q));
}

export function isAllArrived(plan: ArrivalsPlan): boolean {
  if (!plan.snapshot) return false;
  return plan.rows.every((r) => r.remaining === 0 || r.adm_out) && plan.custom.every((c) => c.remaining === 0 || c.adm_out);
}

export type QtyError = 'invalid' | 'max' | null;

export function parseQty(raw: string): { qty: number; error: QtyError } {
  // Ô trống = 0 (blur sẽ ghi lại "0"), không báo lỗi
  if (raw.trim() === '') return { qty: 0, error: null };
  if (!/^-?\d+$/.test(raw.trim())) return { qty: 0, error: 'invalid' };
  const n = Number(raw);
  if (n < 0) return { qty: 0, error: 'invalid' };
  if (n > ARRIVAL_QTY_MAX) return { qty: 0, error: 'max' };
  return { qty: n, error: null };
}
