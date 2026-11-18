import type { AdminConfig, ConfigPatch, SignatureBox } from '@/features/admin/admin.api';

export type ConfigBlock = 'period' | 'signers';
// Khóa = đường dẫn field của CONFIG_INVALID (vd "signature_boxes.1.title"), giá trị = khóa i18n; 'form' = lỗi cả khối
export type FieldErrors = Record<string, string>;

export interface BlockSpec<D> {
  block: ConfigBlock;
  fromConfig: (c: AdminConfig) => D;
  patchOf: (d: D, c: AdminConfig) => ConfigPatch;
  validate: (d: D) => FieldErrors;
  errorOf: (field: string | null, d: D) => FieldErrors;
}

const UNKNOWN: FieldErrors = { form: 'config.errors.UNKNOWN' };
const NAME_MAX = 200;
const TITLE_MAX = 60;

export const isWhole = (v: string) => /^\d+$/.test(v.trim());
export const wholeIn = (v: string, min: number, max: number) => isWhole(v) && Number(v) >= min && Number(v) <= max;

export type PeriodDraft = Record<'registration_last_day' | 'reminder_days_left' | 'default_max_qty', string>;
const PERIOD_KEYS = ['registration_last_day', 'reminder_days_left', 'default_max_qty'] as const;
// Server báo luật "hạn lớn hơn ngày nhắc" ở một trong hai ô, sửa ô nào cũng có thể gỡ lỗi
const PERIOD_LINKED = ['registration_last_day', 'reminder_days_left'] as const;
export const periodClears = (k: keyof PeriodDraft): readonly string[] => ((PERIOD_LINKED as readonly string[]).includes(k) ? PERIOD_LINKED : [k]);

// Cùng luật server (reminderConflict): ngày nhắc phải nhỏ hơn ngày hạn; ô nhắc chưa là số thì so với số đang lưu
export const deadlineHitsReminder = (d: PeriodDraft, savedReminder: number) =>
  Number(d.registration_last_day) <= (isWhole(d.reminder_days_left) ? Number(d.reminder_days_left) : savedReminder);

// Ngày hạn chặn ngoài 3..28 ngay tại ô (cùng luật server); ngày nhắc gõ tay số nào cũng gửi để server so với ngày hạn
export const periodSpec: BlockSpec<PeriodDraft> = {
  block: 'period',
  fromConfig: (c) => ({
    registration_last_day: String(c.registration_last_day),
    reminder_days_left: String(c.reminder_days_left),
    default_max_qty: String(c.default_max_qty),
  }),
  patchOf: (d, c) =>
    Object.fromEntries(
      PERIOD_KEYS.filter((k) => !(isWhole(d[k]) && Number(d[k]) === c[k])).map((k) => [k, isWhole(d[k]) ? Number(d[k]) : d[k]]),
    ),
  validate: (d) => {
    const errors: FieldErrors = {};
    if (!wholeIn(d.registration_last_day, 3, 28)) errors.registration_last_day = 'config.errors.registration_last_day';
    if (!isWhole(d.reminder_days_left)) errors.reminder_days_left = 'config.errors.reminder_days_left';
    if (!wholeIn(d.default_max_qty, 1, 999)) errors.default_max_qty = 'config.errors.default_max_qty';
    return errors;
  },
  errorOf: (field, d) => {
    // Ngày hạn trong 3–28 mà server vẫn từ chối thì chỉ có thể do luật "lớn hơn ngày nhắc"
    if (field === 'registration_last_day') {
      return { [field]: wholeIn(d.registration_last_day, 3, 28) ? 'config.errors.lastDayBelowReminder' : 'config.errors.registration_last_day' };
    }
    if (field === 'reminder_days_left' || field === 'default_max_qty') return { [field]: `config.errors.${field}` };
    return UNKNOWN;
  },
};

export interface BoxDraft extends SignatureBox {
  id: number;
}

export const BOXES_MAX = 3;
let nextBoxId = 0;
export const newBox = (box: SignatureBox = { title: '', title_en: '', name: '' }): BoxDraft => ({ ...box, id: ++nextBoxId });
const trimBox = (b: SignatureBox): SignatureBox => ({ title: b.title.trim(), title_en: b.title_en.trim(), name: b.name.trim() });

const BOX_ERRORS: Record<keyof SignatureBox, string> = {
  title: 'config.errors.boxTitle',
  title_en: 'config.errors.boxTitleEn',
  name: 'config.errors.signer',
};
const BOX_FIELD = /^signature_boxes\.(\d)\.(title|title_en|name)$/;

// Server thay cả mảng, nên đổi một ô cũng gửi đủ các ô
export const signersSpec: BlockSpec<BoxDraft[]> = {
  block: 'signers',
  fromConfig: (c) => c.signature_boxes.map((b) => newBox(b)),
  patchOf: (d, c) => {
    const boxes = d.map(trimBox);
    return JSON.stringify(boxes) === JSON.stringify(c.signature_boxes.map(trimBox)) ? {} : { signature_boxes: boxes };
  },
  validate: (d) => {
    const errors: FieldErrors = {};
    d.map(trimBox).forEach((b, i) => {
      if (b.title === '' || b.title.length > TITLE_MAX) errors[`signature_boxes.${i}.title`] = BOX_ERRORS.title;
      if (b.title_en.length > TITLE_MAX) errors[`signature_boxes.${i}.title_en`] = BOX_ERRORS.title_en;
      if (b.name.length > NAME_MAX) errors[`signature_boxes.${i}.name`] = BOX_ERRORS.name;
    });
    return errors;
  },
  errorOf: (field) => {
    const m = field ? BOX_FIELD.exec(field) : null;
    if (m && field) return { [field]: BOX_ERRORS[m[2] as keyof SignatureBox] };
    if (field?.startsWith('signature_boxes')) return { form: 'config.errors.boxes' };
    return UNKNOWN;
  },
};

export const boxLabel = (box: SignatureBox, language: string) =>
  language.startsWith('en') && box.title_en.trim() ? box.title_en : box.title;
