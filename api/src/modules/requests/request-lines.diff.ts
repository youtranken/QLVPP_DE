import type { ItemFacts } from '../catalog/catalog-sql';
import { unitChoiceError } from '../units/unit-errors';
import type { UnitFacts } from '../units/units.service';
import { duplicateItem, lineError, withLineRef } from './request-errors';
import type { LineRef } from './request-errors';
import {
  isDeletable,
  isMemberReadonly,
  sameSnap,
  snapOf,
} from './request-lines.rules';
import type { LineRow, LineSnap } from './request-lines.rules';
import type { LineInput } from './request.dto';

export interface PlanInput {
  existing: LineRow[];
  body: LineInput[];
  items: Map<string, ItemFacts>;
  units: Map<string, UnitFacts>;
  defaultMaxQty: number;
}

export interface NewLine {
  index: number;
  snap: LineSnap;
  review_status: 'n/a' | 'pending';
}

export interface LinesPlan {
  inserts: NewLine[];
  updates: { before: LineRow; after: LineSnap }[];
  deletes: LineRow[];
  // Ảnh mới gắn vào dòng: writer kiểm chủ sở hữu (cần DB) sau khi plan xong
  images: { fileId: string; ref: LineRef }[];
}

type CustomKey =
  'custom_name' | 'custom_unit' | 'custom_note' | 'image_file_id';

export function planLines(input: PlanInput): LinesPlan {
  const byId = new Map(input.existing.map((l) => [l.id, l]));
  const sent = new Set<string>();
  const plan: LinesPlan = { inserts: [], updates: [], deletes: [], images: [] };
  input.body.forEach((raw, index) => {
    if (!raw.id) return planNew(raw, index, input, plan);
    const before = byId.get(raw.id);
    if (!before || sent.has(raw.id)) {
      throw lineError('LINE_NOT_FOUND', 'Dòng không thuộc phiếu này.', {
        line_index: index,
      });
    }
    sent.add(raw.id);
    planExisting(before, raw, input, plan);
  });
  plan.deletes = input.existing.filter(
    (l) => !sent.has(l.id) && isDeletable(l),
  );
  assertNoDuplicateItems(input.existing, plan);
  return plan;
}

function planNew(
  raw: LineInput,
  index: number,
  input: PlanInput,
  plan: LinesPlan,
): void {
  const ref = { line_index: index };
  if (raw.item_id) assertNoCustomFields(raw, ref);
  const snap: LineSnap = raw.item_id
    ? {
        item_id: raw.item_id,
        custom_name: null,
        custom_unit: null,
        custom_note: raw.custom_note ?? null,
        image_file_id: null,
        qty: raw.qty,
      }
    : {
        item_id: null,
        custom_name: raw.custom_name ?? null,
        custom_unit: raw.custom_unit ?? null,
        custom_note: raw.custom_note ?? null,
        image_file_id: raw.image_file_id ?? null,
        qty: raw.qty,
      };
  validateLine(snap, ref, input);
  assertUnitChoosable(snap, ref, input);
  if (snap.image_file_id) {
    plan.images.push({ fileId: snap.image_file_id, ref });
  }
  plan.inserts.push({
    index,
    snap,
    review_status: snap.item_id ? 'n/a' : 'pending',
  });
}

function planExisting(
  before: LineRow,
  raw: LineInput,
  input: PlanInput,
  plan: LinesPlan,
): void {
  const ref = { line_id: before.id };
  if (raw.item_id !== undefined && raw.item_id !== before.item_id) {
    throw lineError('VALIDATION', 'Không đổi được món của dòng đã lưu.', ref, {
      fields: ['item_id'],
    });
  }
  // Dòng converted giữ ảnh gốc: client gửi lại đúng giá trị đang lưu thì không phải "trường riêng"
  if (before.item_id) assertNoCustomFields(raw, ref, before);
  const after = merge(before, raw);
  if (sameSnap(snapOf(before), after)) return;
  if (isMemberReadonly(before)) {
    throw lineError('LINE_READONLY', 'Dòng này chỉ xem được.', ref);
  }
  validateLine(after, ref, input, after.qty <= before.qty);
  assertUnitChoosable(after, ref, input, before.custom_unit);
  if (after.qty < before.delivered_qty + before.cancelled_qty) {
    throw lineError('QTY_BELOW_DELIVERED', 'Ít hơn số đã giao.', ref, {
      delivered: before.delivered_qty,
    });
  }
  if (after.image_file_id && after.image_file_id !== before.image_file_id) {
    plan.images.push({ fileId: after.image_file_id, ref });
  }
  plan.updates.push({ before, after });
}

// Trường vắng mặt = giữ giá trị cũ; null/chuỗi rỗng = xóa
function merge(before: LineRow, raw: LineInput): LineSnap {
  const keep = (k: CustomKey) =>
    raw[k] === undefined ? before[k] : (raw[k] ?? null);
  const base = {
    ...snapOf(before),
    qty: raw.qty,
    custom_note: keep('custom_note'),
  };
  if (before.item_id) return base;
  return {
    ...base,
    custom_name: keep('custom_name'),
    custom_unit: keep('custom_unit'),
    image_file_id: keep('image_file_id'),
  };
}

function assertNoCustomFields(
  raw: LineInput,
  ref: LineRef,
  stored?: LineRow,
): void {
  const fields = (
    ['custom_name', 'custom_unit', 'image_file_id'] as const
  ).filter(
    (k) => raw[k] !== undefined && raw[k] !== null && raw[k] !== stored?.[k],
  );
  if (fields.length > 0) {
    throw lineError(
      'VALIDATION',
      'Dòng món danh mục không có tên/ĐVT/ảnh riêng.',
      ref,
      {
        fields,
      },
    );
  }
}

// Dòng đã có không tăng SL: bỏ kiểm max (max có thể bị hạ sau khi lưu)
function validateLine(
  line: LineSnap,
  ref: LineRef,
  input: PlanInput,
  notIncreased = false,
): void {
  const qty: unknown = line.qty;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
    throw lineError('QTY_INVALID', 'Số lượng phải là số nguyên ≥ 1.', ref);
  }
  let max = input.defaultMaxQty;
  if (line.item_id) {
    const item = input.items.get(line.item_id);
    if (!item) {
      throw lineError('ITEM_NOT_FOUND', 'Không tìm thấy món.', ref);
    }
    assertOrderable(item, ref);
    max = item.max_qty;
  } else {
    if (!line.custom_name) {
      throw lineError('VALIDATION', 'Nhập tên món.', ref, {
        fields: ['custom_name'],
      });
    }
    if (!line.custom_unit)
      throw lineError('UNIT_REQUIRED', 'Chọn đơn vị tính.', ref);
  }
  if (!notIncreased && qty > max) {
    throw lineError('QTY_EXCEEDS_MAX', `Tối đa ${max}/tháng.`, ref, { max });
  }
}

// Dòng cũ giữ nguyên ĐVT đã ngừng vẫn lưu lại được; chỉ lựa chọn mới phải là ĐVT đang dùng
function assertUnitChoosable(
  line: LineSnap,
  ref: LineRef,
  input: PlanInput,
  storedUnit: string | null = null,
): void {
  if (!line.custom_unit || line.custom_unit === storedUnit) return;
  const error = unitChoiceError(
    input.units.get(line.custom_unit),
    'custom_unit',
  );
  if (error) throw withLineRef(error, ref);
}

function assertOrderable(item: ItemFacts, ref: LineRef): void {
  if (!item.active) throw lineError('ITEM_INACTIVE', 'Món đã ngừng.', ref);
}

function assertNoDuplicateItems(existing: LineRow[], plan: LinesPlan): void {
  const deleted = new Set(plan.deletes.map((l) => l.id));
  const taken = new Set(
    existing
      .filter(
        (l) => l.item_id && l.review_status === 'n/a' && !deleted.has(l.id),
      )
      .map((l) => l.item_id),
  );
  for (const line of plan.inserts) {
    if (!line.snap.item_id) continue;
    if (taken.has(line.snap.item_id)) {
      throw duplicateItem({ line_index: line.index });
    }
    taken.add(line.snap.item_id);
  }
}
