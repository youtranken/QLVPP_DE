
// Chỉ cần hàm dịch theo khóa (TFunction của i18next hoặc bản rút gọn)
type Translate = (key: string) => string;

// API lưu lý do app tự ghi dưới dạng mã "auto:<mã>" để mỗi người đọc theo ngôn ngữ của mình
const AUTO_PREFIX = 'auto:';

export function reviewReasonText(code: string, t: Translate): string | null {
  const key = `common.reviewReason.${code}`;
  const text = t(key);
  return text === key ? null : text;
}

export function reviewNoteText(note: string | null | undefined, t: Translate): string | null {
  const s = note?.trim();
  if (!s) return null;
  // Mã lạ (bản web cũ hơn API): hiện nguyên ghi chú thay vì để trống lý do
  return s.startsWith(AUTO_PREFIX) ? (reviewReasonText(s.slice(AUTO_PREFIX.length), t) ?? s) : s;
}
