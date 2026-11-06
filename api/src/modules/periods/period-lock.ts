import { BadRequestException, ConflictException } from '@nestjs/common';
import { periodFor, vnDate } from '../../common/period';

export type LockState = 'locked' | 'open' | 'future';

// 'YYYY-MM' so sánh chuỗi đúng thứ tự thời gian
export function lockState(ym: string, openYm: string): LockState {
  if (ym < openYm) return 'locked';
  return ym === openYm ? 'open' : 'future';
}

export function isLocked(ym: string, now: Date, lastDay: number): boolean {
  return lockState(ym, periodFor(now, lastDay)) === 'locked';
}

export function lockPhraseVi(deadline: Date): string {
  const { m, d } = vnDate(deadline);
  return `00:00 ngày ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export const periodNotLocked = (open: { ym: string; deadline: Date }) =>
  new ConflictException({
    code: 'PERIOD_NOT_LOCKED',
    message: `Kỳ ${open.ym} đang mở — Hành chính làm việc từ ${lockPhraseVi(open.deadline)}.`,
    ym: open.ym,
    deadline: open.deadline.toISOString(),
  });

export const futurePeriod = () =>
  new BadRequestException({
    code: 'INVALID_PERIOD',
    message: 'Kỳ chưa mở đăng ký.',
  });
