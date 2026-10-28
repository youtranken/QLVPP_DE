import type { AdminConfig, ConfigPatch } from '@/features/admin/admin.api';

export interface ConfigDraft {
  registration_last_day: string;
  default_max_qty: string;
  admin_group: string;
  preparer: string;
  head: string;
  approver: string;
  admin_contact: string;
}

export type DraftField = keyof ConfigDraft;
export type ConfigGroup = 'period' | 'access' | 'signers' | 'contact';
// Giá trị là khóa i18n; 'form' = lỗi không gắn được vào ô nào
export type ConfigErrors = Partial<Record<DraftField | 'form', string>>;

export const GROUP_FIELDS: Record<ConfigGroup, DraftField[]> = {
  period: ['registration_last_day', 'default_max_qty'],
  access: ['admin_group'],
  signers: ['preparer', 'head', 'approver'],
  contact: ['admin_contact'],
};

const SIGNER_FIELDS = new Set<DraftField>(['preparer', 'head', 'approver']);
const NAME_MAX = 200;
const CONTACT_MAX = 500;

export function toDraft(c: AdminConfig): ConfigDraft {
  return {
    registration_last_day: String(c.registration_last_day),
    default_max_qty: String(c.default_max_qty),
    admin_group: c.admin_group,
    preparer: c.signers.preparer,
    head: c.signers.head,
    approver: c.signers.approver,
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
  preparer: (v) => v.trim().length <= NAME_MAX,
  head: (v) => v.trim().length <= NAME_MAX,
  approver: (v) => v.trim().length <= NAME_MAX,
  admin_contact: (v) => v.trim().length <= CONTACT_MAX,
};

const errorKey = (f: DraftField) => (SIGNER_FIELDS.has(f) ? 'config.errors.signer' : `config.errors.${f}`);

export function validateGroup(group: ConfigGroup, d: ConfigDraft): ConfigErrors {
  return Object.fromEntries(GROUP_FIELDS[group].filter((f) => !VALID[f](d[f])).map((f) => [f, errorKey(f)]));
}

const NUMERIC = new Set<DraftField>(['registration_last_day', 'default_max_qty']);
const normalize = (f: DraftField, v: string) => (NUMERIC.has(f) && v.trim() !== '' ? String(Number(v)) : v.trim());

// Chỉ gửi ô đã đổi so với bản server: lưu không đổi gì sẽ không ghi nhật ký,
// và không ghi đè ô người khác vừa sửa (signers được server merge theo từng tên)
export function toPatch(group: ConfigGroup, d: ConfigDraft, base: ConfigDraft): ConfigPatch {
  const changed = GROUP_FIELDS[group].filter((f) => normalize(f, d[f]) !== normalize(f, base[f]));
  if (changed.length === 0) return {};
  const values = Object.fromEntries(changed.map((f) => [f, NUMERIC.has(f) ? Number(d[f]) : d[f].trim()]));
  return group === 'signers' ? { signers: values } : values;
}

// CONFIG_INVALID trả field kiểu "admin_group" hoặc "signers.head"
export function errorsFromApiField(field: string | null): ConfigErrors {
  const key = field?.startsWith('signers.') ? field.slice('signers.'.length) : field;
  if (key && Object.hasOwn(VALID, key)) return { [key]: errorKey(key as DraftField) };
  return { form: 'config.errors.UNKNOWN' };
}
