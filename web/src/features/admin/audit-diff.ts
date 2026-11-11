export interface ChangedField {
  key: string;
  before: string | null;
  after: string | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const display = (v: unknown): string | null => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));

// Một phía null/vắng (tạo mới, xóa) coi như {}; không phía nào là object thì không có bảng
export function changedFields(before: unknown, after: unknown): ChangedField[] | null {
  if (!isObject(before) && !isObject(after)) return null;
  const b = isObject(before) ? before : {};
  const a = isObject(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ key: k, before: display(b[k]), after: display(a[k]) }));
}

export function otherDetail(detail: unknown): { key: string; value: string | null }[] {
  if (!isObject(detail)) return [];
  return Object.entries(detail)
    .filter(([k]) => k !== 'before' && k !== 'after')
    .map(([key, v]) => ({ key, value: display(v) }));
}

const nameIn = (side: unknown): string | null => {
  if (!isObject(side)) return null;
  for (const k of ['name', 'custom_name']) {
    const v = side[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
};

export function auditObjectName(detail: unknown): string | null {
  if (!isObject(detail)) return null;
  return nameIn(detail.after) ?? nameIn(detail.before);
}

// Mã máy (uuid, mã biến động kho, ảnh, bản chốt…) không có nghĩa với người đọc nhật ký: không hiện
const TECHNICAL = new Set(['id', 'ids', 'item_id', 'request_id', 'category_id', 'movement_id', 'image_file_id', 'snapshot_id', 'batch_id', 'line_id', 'ref_line_id', 'file_id']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isTechnicalKey = (key: string) => TECHNICAL.has(key) || key.endsWith('_id') || key.endsWith('_ids');

export type HiddenChange = { kind: 'image' } | { kind: 'category'; id: string | null } | { kind: 'other' };

// Trường đổi mà không có nhãn/không đọc được: vẫn phải báo "có đổi" bằng câu thường, không lộ mã.
// Ảnh và nhóm có câu riêng; còn lại gộp một dòng "Có thay đổi khác"
export function hiddenChanges(keys: { key: string; after: unknown }[]): HiddenChange[] {
  const out: HiddenChange[] = [];
  for (const { key, after } of keys) {
    if (/image/.test(key)) out.push({ kind: 'image' });
    else if (key === 'category_id') out.push({ kind: 'category', id: typeof after === 'string' ? after : null });
  }
  if (keys.some(({ key }) => !/image/.test(key) && key !== 'category_id')) out.push({ kind: 'other' });
  return out.filter((c, i) => c.kind !== 'image' || out.findIndex((x) => x.kind === 'image') === i);
}

// Giá trị đọc được bằng mắt: danh sách chữ/số nối bằng dấu phẩy; object lồng hoặc mã uuid coi như kỹ thuật (undefined = bỏ dòng)
export function readableValue(v: unknown): string | null | undefined {
  if (v == null) return null;
  if (typeof v === 'string') return UUID.test(v) ? undefined : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v) && v.every((x) => x == null || ['string', 'number'].includes(typeof x))) return v.filter((x) => x != null).join(', ');
  return undefined;
}
