import { describe, expect, it } from 'vitest';
import { formatPeriod, isRegistrationOpen, periodForDate } from './period';

describe('periodForDate', () => {
  it('ngày 1–10 → tháng hiện tại', () => {
    expect(periodForDate(new Date(2026, 7, 6))).toBe('2026-08'); // 06/08/2026
    expect(periodForDate(new Date(2026, 7, 10))).toBe('2026-08');
  });

  it('từ ngày 11 → tháng sau', () => {
    expect(periodForDate(new Date(2026, 7, 11))).toBe('2026-09'); // 11/08 → 09/2026
    expect(periodForDate(new Date(2026, 7, 31))).toBe('2026-09');
  });

  it('cuộn năm khi tháng 12 sang tháng sau', () => {
    expect(periodForDate(new Date(2026, 11, 15))).toBe('2027-01'); // 15/12/2026 → 01/2027
  });
});

describe('isRegistrationOpen', () => {
  it('mở trong ngày 1–10', () => {
    expect(isRegistrationOpen(new Date(2026, 7, 1))).toBe(true);
    expect(isRegistrationOpen(new Date(2026, 7, 10))).toBe(true);
  });

  it('đóng từ ngày 11', () => {
    expect(isRegistrationOpen(new Date(2026, 7, 11))).toBe(false);
    expect(isRegistrationOpen(new Date(2026, 7, 25))).toBe(false);
  });
});

describe('formatPeriod', () => {
  it('định dạng tiếng Việt', () => {
    expect(formatPeriod('2026-08')).toBe('Tháng 8/2026');
  });
});
