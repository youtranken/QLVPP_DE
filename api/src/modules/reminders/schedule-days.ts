import { daysLeft, vnDate } from '../../common/period';

export const isPeriodOpenDay = (now: Date): boolean => vnDate(now).d === 1;

// So cả ngày lịch, tính cả hôm nay: kỳ hạn tháng sau không nhắc sớm
export const isReminderDay = (
  now: Date,
  deadline: Date,
  reminderDaysLeft: number,
): boolean => daysLeft(now, deadline) === reminderDaysLeft;

export function isLockDay(now: Date, deadline: Date): boolean {
  const [a, b] = [vnDate(now), vnDate(deadline)];
  return a.y === b.y && a.m === b.m && a.d === b.d;
}
