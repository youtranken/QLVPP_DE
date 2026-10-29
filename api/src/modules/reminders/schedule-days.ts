import { daysLeft, vnDate } from '../../common/period';

// Ngày lastDay − 2 (§9) = còn 3 ngày tính cả hôm nay; so cả ngày lịch nên kỳ hạn tháng sau không nhắc sớm
const REMINDER_DAYS_LEFT = 3;

export const isPeriodOpenDay = (now: Date): boolean => vnDate(now).d === 1;

export const isReminderDay = (now: Date, deadline: Date): boolean =>
  daysLeft(now, deadline) === REMINDER_DAYS_LEFT;

export function isLockDay(now: Date, deadline: Date): boolean {
  const [a, b] = [vnDate(now), vnDate(deadline)];
  return a.y === b.y && a.m === b.m && a.d === b.d;
}
