import type { TFunction } from 'i18next';

// API lưu lý do app tự ghi dưới dạng mã "auto:<mã>" để mỗi người đọc theo ngôn ngữ của mình
const AUTO_PREFIX = 'auto:';

export function reviewReasonText(code: string, t: TFunction): string | null {
  const key = `common.reviewReason.${code}`;
  const text = t(key);
  return text === key ? null : text;
}

export function reviewNoteText(note: string | null | undefined, t: TFunction): string | null {
  const s = note?.trim();
  if (!s) return null;
  return s.startsWith(AUTO_PREFIX) ? reviewReasonText(s.slice(AUTO_PREFIX.length), t) : s;
}
