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
