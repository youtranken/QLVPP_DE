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

export function toPatch(group: ConfigGroup, d: ConfigDraft): ConfigPatch {
  switch (group) {
    case 'period':
      return { registration_last_day: Number(d.registration_last_day), default_max_qty: Number(d.default_max_qty) };
    case 'access':
      return { admin_group: d.admin_group.trim() };
    case 'signers':
      return { signers: { preparer: d.preparer.trim(), head: d.head.trim(), approver: d.approver.trim() } };
    case 'contact':
      return { admin_contact: d.admin_contact.trim() };
  }
}

// CONFIG_INVALID trả field kiểu "admin_group" hoặc "signers.head"
export function errorsFromApiField(field: string | null): ConfigErrors {
  const key = field?.startsWith('signers.') ? field.slice('signers.'.length) : field;
  if (key && Object.hasOwn(VALID, key)) return { [key]: errorKey(key as DraftField) };
  return { form: 'config.errors.UNKNOWN' };
}
