import type { AdminItem, ItemPayload } from '@/features/catalog/catalog.api';

export interface ItemDraft {
  name: string;
  name_en: string;
  unit: string;
  pack_note: string;
  category_id: string;
  image_file_id: string | null;
  admin_only: boolean;
  max_qty: string;
  min_stock: string;
  sort_order: string;
}

export const ITEM_FIELDS: (keyof ItemDraft)[] = [
  'name',
  'name_en',
  'unit',
  'pack_note',
  'category_id',
  'image_file_id',
  'admin_only',
  'max_qty',
  'min_stock',
  'sort_order',
];

// Mã lỗi server → ô hiển thị lỗi
export const ITEM_ERROR_FIELD: Record<string, string> = {
  IMAGE_REQUIRED: 'image_file_id',
  FILE_FORBIDDEN: 'image_file_id',
  UNIT_REQUIRED: 'unit',
  CATEGORY_NOT_FOUND: 'category_id',
};

export function draftFrom(item: AdminItem | null, defaultMaxQty: number): ItemDraft {
  return {
    name: item?.name ?? '',
    name_en: item?.name_en ?? '',
    unit: item?.unit ?? '',
    pack_note: item?.pack_note ?? '',
    category_id: item?.category_id ?? '',
    image_file_id: item?.image_file_id ?? null,
    admin_only: item?.admin_only ?? false,
    max_qty: String(item?.max_qty ?? defaultMaxQty),
    min_stock: String(item?.min_stock ?? 0),
    sort_order: String(item?.sort_order ?? 0),
  };
}

const textOrNull = (v: string) => (v.trim() === '' ? null : v.trim());
// Ô số để trống gửi null để server báo VALIDATION đúng ô, không ngầm thành 0
const intOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function toPayload(d: ItemDraft): ItemPayload {
  return {
    name: d.name.trim(),
    name_en: textOrNull(d.name_en),
    unit: d.unit,
    pack_note: textOrNull(d.pack_note),
    category_id: textOrNull(d.category_id),
    image_file_id: d.image_file_id,
    admin_only: d.admin_only,
    max_qty: intOrNull(d.max_qty) as number,
    min_stock: intOrNull(d.min_stock) as number,
    sort_order: intOrNull(d.sort_order) as number,
  };
}

// Sửa chỉ gửi trường đã đổi: audit before/after gọn, không ghi đè thay đổi của người khác
export function itemPayload(d: ItemDraft, item: AdminItem | null): ItemPayload {
  const full = toPayload(d);
  if (!item) return full;
  return Object.fromEntries(
    Object.entries(full).filter(([k, v]) => item[k as keyof AdminItem] !== v),
  ) as ItemPayload;
}
