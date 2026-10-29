import { useTranslation } from 'react-i18next';

export interface Cap {
  limit: number;
  message: string;
}

const toInt = (text: string) => (text.trim() !== '' && Number.isInteger(Number(text)) ? Number(text) : null);

// Luật thật ở server (1…còn lại, đủ tồn); ở đây chỉ để không bấm vô ích và báo đúng ô
export function useQtyCheck(text: string, remaining: number, cap: Cap | null) {
  const { t } = useTranslation();
  const n = toInt(text);
  const max = Math.min(remaining, cap?.limit ?? remaining);
  const fail = (error: string | null) => ({ n, max, error, ok: false });
  if (text.trim() === '') return fail(null);
  if (n === null) return fail(t('delivery.line.invalid'));
  if (n < 1) return fail(t('delivery.line.min'));
  if (n > max) return fail(cap && n > cap.limit ? cap.message : t('delivery.line.max', { max }));
  return { n, max, error: null, ok: true };
}
