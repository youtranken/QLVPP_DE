import type { TFunction } from 'i18next';
import { lockPhrase } from '@/lib/period-text';
import { shiftYm } from '@/lib/ym';
import { wholeIn } from './config-form';

// Mốc khóa của kỳ tạo theo hạn mới: 00:00 ngày (hạn + 1) giờ VN = 17:00 UTC ngày hạn, như deadlineOf ở api
export function deadlineFor(ym: string, lastDay: number): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, lastDay, 17)).toISOString();
}

// Hạn mới không đổi kỳ đang mở (kỳ đã tạo giữ hạn cũ); chỉ kỳ kế tiếp khóa theo ô đang nhập
export function effectiveSentence(t: TFunction, lang: 'vi' | 'en', open: { ym: string; deadline: string }, lastDay: string): string {
  const current = t('config.period.effectiveOpen', { open: open.ym.slice(5), lock: lockPhrase(open.deadline, lang) });
  if (!wholeIn(lastDay, 3, 28)) return current;
  const next = shiftYm(open.ym, 1);
  return `${current} ${t('config.period.effectiveNext', { next: next.slice(5), lock: lockPhrase(deadlineFor(next, Number(lastDay)), lang) })}`;
}
