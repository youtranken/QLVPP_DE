import type { AdminConfig, ConfigPatch, SignatureBox } from '@/features/admin/admin.api';

export interface ConfigDraft {
  registration_last_day: string;
  default_max_qty: string;
  admin_group: string;
  sign0: string;
  sign1: string;
  sign2: string;
  admin_contact: string;
}

export type DraftField = keyof ConfigDraft;
export type ConfigGroup = 'period' | 'access' | 'signers' | 'contact';
// Giá trị là khóa i18n; 'form' = lỗi không gắn được vào ô nào
export type ConfigErrors = Partial<Record<DraftField | 'form', string>>;

export const GROUP_FIELDS: Record<ConfigGroup, DraftField[]> = {
  period: ['registration_last_day', 'default_max_qty'],
  access: ['admin_group'],
  signers: ['sign0', 'sign1', 'sign2'],
  contact: ['admin_contact'],
};

export const SIGN_FIELDS = ['sign0', 'sign1', 'sign2'] as const;
const SIGNER_FIELDS = new Set<DraftField>(SIGN_FIELDS);
const NAME_MAX = 200;
const CONTACT_MAX = 500;

export function toDraft(c: AdminConfig): ConfigDraft {
  return {
    registration_last_day: String(c.registration_last_day),
    default_max_qty: String(c.default_max_qty),
    admin_group: c.admin_group,
    sign0: c.signature_boxes[0]?.name ?? '',
    sign1: c.signature_boxes[1]?.name ?? '',
    sign2: c.signature_boxes[2]?.name ?? '',
    admin_contact: c.admin_contact,
  };
}

const intIn = (v: string, min: number, max: number) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
};

const VALID: Record<DraftField, (v: string) => boolean> = {
  registration_last_day: (v) => intIn(v, 3, 28),
  default_max_qty: (v) => intIn(v, 1, 999),
  admin_group: (v) => v.trim() !== '' && v.trim().length <= NAME_MAX,
  sign0: (v) => v.trim().length <= NAME_MAX,
  sign1: (v) => v.trim().length <= NAME_MAX,
  sign2: (v) => v.trim().length <= NAME_MAX,
  admin_contact: (v) => v.trim().length <= CONTACT_MAX,
};

const errorKey = (f: DraftField) => (SIGNER_FIELDS.has(f) ? 'config.errors.signer' : `config.errors.${f}`);

export function validateGroup(group: ConfigGroup, d: ConfigDraft): ConfigErrors {
  return Object.fromEntries(GROUP_FIELDS[group].filter((f) => !VALID[f](d[f])).map((f) => [f, errorKey(f)]));
}

const NUMERIC = new Set<DraftField>(['registration_last_day', 'default_max_qty']);
const normalize = (f: DraftField, v: string) => (NUMERIC.has(f) && v.trim() !== '' ? String(Number(v)) : v.trim());

// Chỉ gửi ô đã đổi so với bản server: lưu không đổi gì sẽ không ghi nhật ký,
// và không ghi đè ô người khác vừa sửa. Ô ký: server thay cả mảng nên gửi đủ các ô hiện có.
export function toPatch(group: ConfigGroup, d: ConfigDraft, base: ConfigDraft, boxes: SignatureBox[]): ConfigPatch {
  const changed = GROUP_FIELDS[group].filter((f) => normalize(f, d[f]) !== normalize(f, base[f]));
  if (changed.length === 0) return {};
  if (group === 'signers') return { signature_boxes: boxes.map((b, i) => ({ ...b, name: d[SIGN_FIELDS[i]].trim() })) };
  return Object.fromEntries(changed.map((f) => [f, NUMERIC.has(f) ? Number(d[f]) : d[f].trim()]));
}

const SIGN_NAME_FIELD = /^signature_boxes\.([0-2])\.name$/;
const SIGN_TITLE_FIELD = /^signature_boxes\.[0-2]\.title(_en)?$/;

// Ô ngày hạn đã qua kiểm 3–28 ở client nên server từ chối nó chỉ có thể là luật "lớn hơn ngày nhắc"
const SERVER_ERROR_KEYS: Partial<Record<DraftField, string>> = {
  registration_last_day: 'config.errors.lastDayBelowReminder',
};

// CONFIG_INVALID trả field kiểu "admin_group" hoặc "signature_boxes.0.name"
export function errorsFromApiField(field: string | null): ConfigErrors {
  if (field && SIGN_TITLE_FIELD.test(field)) return { form: 'config.errors.signBoxTitle' };
  const sign = field ? SIGN_NAME_FIELD.exec(field) : null;
  const key = sign ? SIGN_FIELDS[Number(sign[1])] : field;
  if (key && Object.hasOwn(VALID, key)) {
    const f = key as DraftField;
    return { [f]: SERVER_ERROR_KEYS[f] ?? errorKey(f) };
  }
  return { form: 'config.errors.UNKNOWN' };
}

export const boxLabel = (box: SignatureBox, language: string) =>
  language.startsWith('en') && box.title_en ? box.title_en : box.title;
