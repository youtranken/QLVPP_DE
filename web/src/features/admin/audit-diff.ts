export interface ChangedField {
  key: string;
  before: string | null;
  after: string | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

// Một phía null/vắng (tạo mới, xóa) coi như {}; không phía nào là object thì không có bảng
export function changedFields(before: unknown, after: unknown): ChangedField[] | null {
  if (!isObject(before) && !isObject(after)) return null;
  const b = isObject(before) ? before : {};
  const a = isObject(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const show = (o: Record<string, unknown>, k: string) => (k in o ? JSON.stringify(o[k]) : null);
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ key: k, before: show(b, k), after: show(a, k) }));
}

export function otherDetail(detail: unknown): { key: string; value: string }[] {
  if (!isObject(detail)) return [];
  return Object.entries(detail)
    .filter(([k]) => k !== 'before' && k !== 'after')
    .map(([key, v]) => ({ key, value: JSON.stringify(v) }));
}
