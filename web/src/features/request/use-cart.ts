import { useMemo, useRef, useState } from 'react';
import type { LineInputBody, LineView, MemberItem, RequestView, ReviewStatus, SaveLinesBody } from './request.api';

export interface CartLabel {
  name: string;
  name_en: string | null;
  unit: string | null;
  pack_note: string | null;
  image_file_id: string | null;
  category_id: string | null;
}

export interface CartLine {
  key: string;
  id?: string;
  item_id: string | null;
  custom_name: string | null;
  custom_unit: string | null;
  custom_note: string | null;
  image_file_id: string | null;
  qty: number;
  min: number;
  max: number;
  readonly: boolean;
  added_by_admin: boolean;
  review_status: ReviewStatus | null;
  label: CartLabel;
}

export type CustomLineInput = Pick<CartLine, 'custom_name' | 'custom_unit' | 'custom_note' | 'image_file_id' | 'qty'>;
export type ReplaceLineInput = { item_id: string; qty: number } | CustomLineInput;

interface CartContext {
  ym: string;
  items: Map<string, MemberItem>;
  defaultMax: number;
}

// Dòng món thường khóa theo item_id để thẻ lưới tìm ra; dòng ngoài DM/đã duyệt có thể trùng món nên khóa theo id
const keyOf = (l: LineView) => (l.item_id && l.review_status === 'n/a' ? l.item_id : l.id);

function itemLabel(i: MemberItem): CartLabel {
  const { name, name_en, unit, pack_note, image_file_id, category_id } = i;
  return { name, name_en, unit, pack_note, image_file_id, category_id };
}

const orderable = (item: MemberItem | undefined, l: LineView) =>
  !!item && item.active && !item.admin_only && l.item?.active !== false;

// Server cho giảm dòng đã lưu bất kể max_qty hiện tại; món ngừng/chỉ Hành chính thì member chỉ được bỏ dòng
function savedLimits(l: LineView, item: MemberItem | undefined, defaultMax: number) {
  if (!l.item_id) return { min: 1, max: Math.max(defaultMax, l.qty) };
  if (!orderable(item, l)) return { min: l.qty, max: l.qty };
  return { min: 1, max: Math.max(item!.max_qty, l.qty) };
}

function fromView(l: LineView, ctx: CartContext): CartLine {
  const item = l.item_id ? ctx.items.get(l.item_id) : undefined;
  const label: CartLabel = l.item
    ? { ...l.item, category_id: item?.category_id ?? null }
    : {
        name: l.custom_name ?? '',
        name_en: null,
        unit: l.custom_unit,
        pack_note: null,
        image_file_id: l.image_file_id,
        category_id: null,
      };
  return {
    key: keyOf(l),
    id: l.id,
    item_id: l.item_id,
    custom_name: l.custom_name,
    custom_unit: l.custom_unit,
    custom_note: l.custom_note,
    image_file_id: l.image_file_id,
    qty: l.qty,
    ...savedLimits(l, item, ctx.defaultMax),
    readonly: l.readonly_for_member,
    added_by_admin: l.added_by_admin,
    review_status: l.review_status,
    label,
  };
}

const canOrder = (i: MemberItem) => i.active && !i.admin_only;

// Dòng chỉ đọc (Hành chính thêm…) không bao giờ làm gốc: dùng lại id của nó sẽ gửi trùng id
function fromItem(i: MemberItem, qty: number, prior?: CartLine): CartLine {
  const base = prior && !prior.readonly ? prior : undefined;
  const saved = base?.qty ?? qty;
  const [min, max] = canOrder(i) ? [1, Math.max(i.max_qty, base?.qty ?? 0)] : [saved, saved];
  return {
    key: i.id,
    id: base?.id,
    item_id: i.id,
    custom_name: null,
    custom_unit: null,
    custom_note: base?.custom_note ?? null,
    image_file_id: null,
    qty: Math.min(Math.max(qty, min), max),
    min,
    max,
    readonly: false,
    added_by_admin: false,
    review_status: base?.review_status ?? 'n/a',
    label: base?.label ?? itemLabel(i),
  };
}

const sameLine = (a: CartLine, b: CartLine) =>
  a.qty === b.qty &&
  a.custom_name === b.custom_name &&
  a.custom_unit === b.custom_unit &&
  a.custom_note === b.custom_note &&
  a.image_file_id === b.image_file_id;

export function countDirty(base: CartLine[], lines: CartLine[]): number {
  const byId = new Map(base.map((l) => [l.id, l]));
  const kept = new Set(lines.map((l) => l.id).filter(Boolean));
  const changed = lines.filter((l) => !l.id || !byId.has(l.id) || !sameLine(byId.get(l.id)!, l)).length;
  const removed = base.filter((l) => !l.readonly && !kept.has(l.id)).length;
  return changed + removed;
}

const customOf = ({ custom_name, custom_unit, custom_note, image_file_id, qty }: CartLine): CustomLineInput => ({
  custom_name,
  custom_unit,
  custom_note,
  image_file_id,
  qty,
});

// Dòng món đã lưu chỉ gửi id + qty (trường vắng mặt server giữ nguyên); dòng ngoài DM gửi kèm trường riêng vì sửa được
function toInput(l: CartLine): LineInputBody {
  if (l.id) return l.item_id ? { id: l.id, qty: l.qty } : { id: l.id, ...customOf(l) };
  if (l.item_id) return { item_id: l.item_id, qty: l.qty };
  return customOf(l);
}

// Chuyển giỏ sang kỳ khác: bỏ dòng Hành chính thêm/bị từ chối (như chép lại), các dòng còn lại thành dòng mới
export function carryOf(lines: CartLine[]): ReplaceLineInput[] {
  return lines
    .filter((l) => !l.added_by_admin && l.review_status !== 'rejected')
    .map((l) => (l.item_id ? { item_id: l.item_id, qty: l.qty } : customOf(l)));
}

// Kết quả thay giỏ: món trùng dòng Hành chính đã thêm, số món không còn đặt được
export interface ReplaceReport {
  heldByAdmin: string[];
  unavailable: number;
}

export function useCart(server: RequestView | null, ctx: CartContext, initial?: ReplaceLineInput[]) {
  const [saved, setSaved] = useState(server);
  const base = useMemo(() => (saved?.lines ?? []).map((l) => fromView(l, ctx)), [saved, ctx]);
  const tmpSeq = useRef(0);
  const baseByKey = useMemo(() => new Map(base.map((l) => [l.key, l])), [base]);

  const customLine = (c: CustomLineInput): CartLine => {
    tmpSeq.current += 1;
    return {
      key: `tmp-${tmpSeq.current}`,
      item_id: null,
      ...c,
      qty: Math.min(c.qty, ctx.defaultMax),
      min: 1,
      max: ctx.defaultMax,
      readonly: false,
      added_by_admin: false,
      review_status: 'pending',
      label: { name: c.custom_name ?? '', name_en: null, unit: c.custom_unit, pack_note: null, image_file_id: c.image_file_id, category_id: null },
    };
  };

  // Dòng chỉ đọc giữ nguyên (món trùng dòng đó thì bỏ và báo); món thường gắn lại vào dòng đã lưu cùng món (giữ id)
  const replaced = (prev: CartLine[], next: ReplaceLineInput[]): { lines: CartLine[]; report: ReplaceReport } => {
    const held = prev.filter((l) => l.readonly);
    const heldKeys = new Set(held.map((l) => l.key));
    const report: ReplaceReport = { heldByAdmin: [], unavailable: 0 };
    const fresh = next.flatMap((n) => {
      if (!('item_id' in n)) return [customLine(n)];
      const item = ctx.items.get(n.item_id);
      if (!item || !canOrder(item)) {
        report.unavailable += 1;
        return [];
      }
      if (heldKeys.has(n.item_id)) {
        report.heldByAdmin.push(item.name);
        return [];
      }
      return [fromItem(item, n.qty, baseByKey.get(n.item_id))];
    });
    return { lines: [...held, ...fresh], report };
  };

  const [init] = useState(() => (initial ? replaced(base, initial) : { lines: base, report: null }));
  const [lines, setLines] = useState<CartLine[]>(init.lines);

  const editable = (key: string) => !lines.find((l) => l.key === key)?.readonly;

  const setQty = (key: string, n: number) => {
    if (!editable(key)) return;
    setLines((prev) => {
      const at = prev.findIndex((l) => l.key === key);
      if (at < 0) {
        const item = ctx.items.get(key);
        if (!item || n <= 0) return prev;
        return [...prev, fromItem(item, n, baseByKey.get(key))];
      }
      if (n <= 0) return prev.filter((l) => l.key !== key);
      return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(Math.max(n, l.min), l.max) } : l));
    });
  };

  const remove = (key: string) => {
    if (editable(key)) setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const addCustom = (c: CustomLineInput) => setLines((prev) => [...prev, customLine(c)]);

  const updateCustom = (key: string, c: CustomLineInput) => {
    if (!editable(key)) return;
    const label = { name: c.custom_name ?? '', unit: c.custom_unit, image_file_id: c.image_file_id };
    setLines((prev) =>
      prev.map((l) =>
        l.key === key && !l.item_id ? { ...l, ...c, qty: Math.min(c.qty, l.max), label: { ...l.label, ...label } } : l,
      ),
    );
  };

  const replaceAll = (next: ReplaceLineInput[]): ReplaceReport => {
    const out = replaced(lines, next);
    setLines(out.lines);
    return out.report;
  };

  const toBody = (): SaveLinesBody => ({
    ym: ctx.ym,
    ...(saved ? { expected_updated_at: saved.updated_at } : {}),
    lines: lines.map(toInput),
  });

  const markSaved = (view: RequestView | null) => {
    setSaved(view);
    setLines((view?.lines ?? []).map((l) => fromView(l, ctx)));
  };

  return {
    lines,
    dirtyCount: countDirty(base, lines),
    saved,
    initialReport: init.report,
    setQty,
    remove,
    addCustom,
    updateCustom,
    replaceAll,
    toBody,
    markSaved,
  };
}

export type Cart = ReturnType<typeof useCart>;
