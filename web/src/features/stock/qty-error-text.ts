import type { TFunction } from 'i18next';
import type { QtyError } from './stock-input';

const LOCALE = { vi: 'vi-VN', en: 'en-US' } as const;

// Câu lỗi ô số đứng cạnh ô; "minRange" khi có trần theo tủ (Xuất lẻ), "min" khi chỉ có sàn (Nhập mua)
export function qtyErrorText(t: TFunction, lang: string, e: QtyError | null, withRange: boolean): string | null {
  if (!e || e.code === 'empty') return null;
  const max = new Intl.NumberFormat(LOCALE[lang as keyof typeof LOCALE] ?? LOCALE.vi).format(e.max);
  const key = e.code === 'min' && withRange ? 'minRange' : e.code;
  return t(`stock.dialog.qtyError.${key}`, { max });
}
