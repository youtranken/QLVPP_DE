import { isLockDay, isPeriodOpenDay, isReminderDay } from './schedule-days';

const DEC_DEADLINE = new Date('2026-12-10T17:00:00Z'); // 00:00 11/12 VN, lastDay 10

describe('ngày gửi chuông theo giờ VN', () => {
  it.each([
    ['2026-11-30T16:59:59.999Z', false], // 23:59:59.999 30/11 VN
    ['2026-11-30T17:00:00Z', true], // 00:00 1/12 VN
    ['2026-12-01T16:59:59.999Z', true], // 23:59:59.999 1/12 VN
    ['2026-12-01T17:00:00Z', false], // 00:00 2/12 VN
    ['2026-12-31T17:00:00Z', true], // 00:00 1/1/2027 VN
  ])('period_open chỉ ngày 1 VN: %s → %s', (at, expected) => {
    expect(isPeriodOpenDay(new Date(at))).toBe(expected);
  });

  it.each([
    ['2026-12-07T16:59:59.999Z', false], // 23:59:59.999 7/12 VN
    ['2026-12-07T17:00:00Z', true], // 00:00 8/12 VN = lastDay 10 − 2
    ['2026-12-08T16:59:59.999Z', true], // 23:59:59.999 8/12 VN
    ['2026-12-08T17:00:00Z', false], // 00:00 9/12 VN
  ])('reminder ngày lastDay − 2 (hạn 10/12): %s → %s', (at, expected) => {
    expect(isReminderDay(new Date(at), DEC_DEADLINE)).toBe(expected);
  });

  it('registration_last_day 3 → nhắc ngày 1; 28 tháng 2 → nhắc ngày 26', () => {
    const mar3 = new Date('2027-03-03T17:00:00Z'); // 00:00 4/3 VN
    expect(isReminderDay(new Date('2027-02-28T17:00:00Z'), mar3)).toBe(true); // 00:00 1/3 VN
    expect(isReminderDay(new Date('2027-02-28T16:59:59.999Z'), mar3)).toBe(
      false,
    );
    const feb28 = new Date('2027-02-28T17:00:00Z'); // 00:00 1/3 VN, lastDay 28
    expect(isReminderDay(new Date('2027-02-25T17:00:00Z'), feb28)).toBe(true); // 00:00 26/2 VN
    expect(isReminderDay(new Date('2027-02-25T16:59:59.999Z'), feb28)).toBe(
      false,
    );
  });

  it('kỳ mở có hạn tháng sau (config đổi 3 → 28): ngày 26 tháng này không nhắc', () => {
    const dec29 = new Date('2026-12-28T17:00:00Z'); // kỳ 12 lastDay 28, mở từ 4/11
    expect(isReminderDay(new Date('2026-11-25T17:00:00Z'), dec29)).toBe(false); // 00:00 26/11 VN
    expect(isReminderDay(new Date('2026-12-25T17:00:00Z'), dec29)).toBe(true); // 00:00 26/12 VN
  });

  it.each([
    ['2026-12-10T16:59:59.999Z', false], // hạn − 1 ms: 23:59:59.999 10/12 VN
    ['2026-12-10T17:00:00Z', true], // đúng hạn: 00:00 11/12 VN
    ['2026-12-11T16:59:59.999Z', true], // 23:59:59.999 11/12 VN
    ['2026-12-11T17:00:00Z', false], // 00:00 12/12 VN
  ])('period_locked đúng ngày VN của hạn: %s → %s', (at, expected) => {
    expect(isLockDay(new Date(at), DEC_DEADLINE)).toBe(expected);
  });
});
