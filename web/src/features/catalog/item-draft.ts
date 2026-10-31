import type { AdminItem, ItemPayload } from '@/features/catalog/catalog.api';

export interface ItemDraft {
  code: string;
  name: string;
  name_en: string;
  unit: string;
  pack_note: string;
  category_id: string;
  image_file_id: string | null;
  admin_only: boolean;
  max_qty: string;
  sort_order: string;
}

export const ITEM_FIELDS: (keyof ItemDraft)[] = [
  'code',
  'name',
  'name_en',
  'unit',
  'pack_note',
  'category_id',
  'image_file_id',
  'admin_only',
  'max_qty',
  'sort_order',
];

// Mã lỗi server → ô hiển thị lỗi
export const ITEM_ERROR_FIELD: Record<string, string> = {
  IMAGE_REQUIRED: 'image_file_id',
  FILE_FORBIDDEN: 'image_file_id',
  FILE_TOO_LARGE: 'image_file_id',
  FILE_TYPE_INVALID: 'image_file_id',
  ITEM_CODE_EXISTS: 'code',
  UNIT_REQUIRED: 'unit',
  UNIT_INACTIVE: 'unit',
  CATEGORY_NOT_FOUND: 'category_id',
};

export function draftFrom(item: AdminItem | null, defaultMaxQty: number): ItemDraft {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    name_en: item?.name_en ?? '',
    unit: item?.unit ?? '',
    pack_note: item?.pack_note ?? '',
    category_id: item?.category_id ?? '',
    image_file_id: item?.image_file_id ?? null,
    admin_only: item?.admin_only ?? false,
    max_qty: String(item?.max_qty ?? defaultMaxQty),
    sort_order: String(item?.sort_order ?? 0),
  };
}

const textOrNull = (v: string) => (v.trim() === '' ? null : v.trim());
// Ô số để trống gửi null để server báo VALIDATION đúng ô, không ngầm thành 0
const intOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function toPayload(d: ItemDraft): ItemPayload {
  return {
    code: textOrNull(d.code),
    name: d.name.trim(),
    name_en: textOrNull(d.name_en),
    unit: d.unit,
    pack_note: textOrNull(d.pack_note),
    category_id: textOrNull(d.category_id),
    image_file_id: d.image_file_id,
    admin_only: d.admin_only,
    max_qty: intOrNull(d.max_qty) as number,
    sort_order: intOrNull(d.sort_order) as number,
  };
}

export const REQUIRED_FIELDS = ['image_file_id', 'name', 'unit', 'max_qty'] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

// Giống server: món mới phải đủ cả bốn; sửa món chỉ báo ô bị xóa trống (món nhập chưa có ảnh vẫn sửa được ô khác)
export function missingFields(d: ItemDraft, saved: ItemDraft | null): RequiredField[] {
  const empty: Record<RequiredField, (x: ItemDraft) => boolean> = {
    image_file_id: (x) => x.image_file_id === null,
    name: (x) => x.name.trim() === '',
    unit: (x) => x.unit === '',
    max_qty: (x) => x.max_qty.trim() === '',
  };
  return REQUIRED_FIELDS.filter((f) => empty[f](d) && (saved === null || !empty[f](saved)));
}

// Sửa chỉ gửi trường đã đổi: audit before/after gọn, không ghi đè thay đổi của người khác
export function itemPayload(d: ItemDraft, item: AdminItem | null): ItemPayload {
  const full = toPayload(d);
  if (!item) return full;
  return Object.fromEntries(
    Object.entries(full).filter(([k, v]) => item[k as keyof AdminItem] !== v),
  ) as ItemPayload;
}
