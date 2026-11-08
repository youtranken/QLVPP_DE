export interface SignatureBox {
  title: string;
  title_en: string;
  name: string;
}

export interface ConfigPatch {
  registration_last_day?: number;
  reminder_days_left?: number;
  default_max_qty?: number;
  low_stock_notify?: boolean;
  signature_boxes?: SignatureBox[];
  admin_contact?: string;
}

export type ConfigPatchResult =
  { ok: true; patch: ConfigPatch } | { ok: false; field: string };

export interface ReminderWindow {
  registration_last_day: number;
  reminder_days_left: number;
}

const BOX_LIMITS: Record<keyof SignatureBox, { min: number; max: number }> = {
  title: { min: 1, max: 60 },
  title_en: { min: 0, max: 60 },
  name: { min: 0, max: 200 },
};
const BOXES_MIN = 1;
const BOXES_MAX = 3;
const CONTACT_MAX = 500;

const isIntIn = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length <= max;
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const RULES: Record<keyof ConfigPatch, (v: unknown) => boolean> = {
  registration_last_day: (v) => isIntIn(v, 3, 28),
  reminder_days_left: (v) => isIntIn(v, 1, 7),
  default_max_qty: (v) => isIntIn(v, 1, 999),
  low_stock_notify: (v) => typeof v === 'boolean',
  signature_boxes: (v) =>
    Array.isArray(v) && v.length >= BOXES_MIN && v.length <= BOXES_MAX,
  admin_contact: (v) => isText(v, CONTACT_MAX),
};

export function validateConfigPatch(body: unknown): ConfigPatchResult {
  if (!isPlainObject(body) || Object.keys(body).length === 0) {
    return { ok: false, field: 'body' };
  }
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    // hasOwn: tên kế thừa (constructor, __proto__…) không được lọt whitelist
    const rule = Object.hasOwn(RULES, key)
      ? RULES[key as keyof ConfigPatch]
      : undefined;
    if (!rule || !rule(value)) return { ok: false, field: key };
    if (key === 'signature_boxes') {
      const boxes = normalizeBoxes(value as unknown[]);
      if (typeof boxes === 'string') return { ok: false, field: boxes };
      patch[key] = boxes;
    } else {
      patch[key] = value;
    }
  }
  return { ok: true, patch };
}

function normalizeBoxes(boxes: unknown[]): SignatureBox[] | string {
  const out: SignatureBox[] = [];
  for (const [i, raw] of boxes.entries()) {
    const path = `signature_boxes.${i}`;
    if (!isPlainObject(raw)) return path;
    const unknownKey = Object.keys(raw).find(
      (k) => !Object.hasOwn(BOX_LIMITS, k),
    );
    if (unknownKey !== undefined) return `${path}.${unknownKey}`;
    const box: Record<string, string> = {};
    for (const [field, { min, max }] of Object.entries(BOX_LIMITS)) {
      const value = raw[field];
      const text = typeof value === 'string' ? value.trim() : null;
      if (text === null || text.length < min || text.length > max) {
        return `${path}.${field}`;
      }
      box[field] = text;
    }
    out.push(box as unknown as SignatureBox);
  }
  return out;
}

// Lỗi gắn vào khóa admin vừa sửa: bản vá có reminder thì báo reminder, chỉ vá hạn thì báo hạn
export function reminderConflict(
  patch: ConfigPatch,
  current: ReminderWindow,
): keyof ReminderWindow | null {
  const lastDay = patch.registration_last_day ?? current.registration_last_day;
  const daysLeft = patch.reminder_days_left ?? current.reminder_days_left;
  if (daysLeft <= lastDay - 1) return null;
  if (patch.reminder_days_left !== undefined) return 'reminder_days_left';
  if (patch.registration_last_day !== undefined) return 'registration_last_day';
  return null;
}
