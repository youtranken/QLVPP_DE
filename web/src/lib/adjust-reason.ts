import type { TFunction } from 'i18next';

// Ghi chú là chữ thuần (React tự thoát HTML); xuống dòng hiện như dấu cách
const flat = (note: string) => note.replace(/\s*[\r\n]+\s*/g, ' ').trim();

// "Khác" hiện chính ghi chú; mã khác: nhãn theo ngôn ngữ đang xem + ": ghi chú" nếu có
export function adjustReasonText(t: TFunction, code: string, note: string | null | undefined): string {
  const text = note ? flat(note) : '';
  if (code === 'other' && text) return text;
  const label = t(`adjustReason.${code}`);
  return text ? `${label}: ${text}` : label;
}
