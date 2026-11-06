import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LineView } from './request.api';

export type ChipTone = 'ok' | 'warn' | 'muted' | 'open' | 'danger';

// Nhãn trạng thái dạng viên thuốc của Lịch sử (v2): màu luôn đi kèm chữ
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`hs-chip hs-chip--${tone}`}>{children}</span>;
}

// Trạng thái xem của Hành chính cho dòng ngoài danh mục (chờ / chấp nhận / từ chối kèm lý do)
export function ReviewTag({ line }: { line: LineView }) {
  const { t } = useTranslation();
  const s = line.review_status;
  if (s === 'n/a') return null;
  if (s === 'rejected') {
    const reason = line.review_note?.trim();
    return <Chip tone="danger">{reason ? t('request.history.review.rejectedWhy', { reason }) : t('request.history.review.rejected')}</Chip>;
  }
  return <Chip tone={s === 'pending' ? 'warn' : 'ok'}>{t(`request.history.review.${s}`)}</Chip>;
}
