export interface Signers {
  preparer: string;
  head: string;
  approver: string;
}

export interface ConfigPatch {
  registration_last_day?: number;
  default_max_qty?: number;
  admin_group?: string;
  low_stock_notify?: boolean;
  signers?: Partial<Signers>;
  admin_contact?: string;
}

export type ConfigPatchResult =
  { ok: true; patch: ConfigPatch } | { ok: false; field: string };

const SIGNER_KEYS = ['preparer', 'head', 'approver'] as const;
const NAME_MAX = 200;
const CONTACT_MAX = 500;

const isIntIn = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length <= max;
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const RULES: Record<keyof ConfigPatch, (v: unknown) => boolean> = {
  registration_last_day: (v) => isIntIn(v, 3, 28),
  default_max_qty: (v) => isIntIn(v, 1, 999),
  admin_group: (v) => isText(v, NAME_MAX) && v.trim() !== '',
  low_stock_notify: (v) => typeof v === 'boolean',
  signers: isPlainObject,
  admin_contact: (v) => isText(v, CONTACT_MAX),
};

// authorized_groups không có trong RULES: chỉ directory-sync được ghi
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
    if (key === 'signers') {
      const bad = invalidSignerKey(value as Record<string, unknown>);
      if (bad) return { ok: false, field: `signers.${bad}` };
    }
    patch[key] = key === 'admin_group' ? (value as string).trim() : value;
  }
  return { ok: true, patch };
}

function invalidSignerKey(signers: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(signers)) {
    const known = (SIGNER_KEYS as readonly string[]).includes(key);
    if (!known || !isText(value, NAME_MAX)) return key;
  }
  return null;
}
