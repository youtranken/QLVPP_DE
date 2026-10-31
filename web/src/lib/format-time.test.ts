import { describe, expect, it } from 'vitest';
import { vnDeadlineDay, vnLockDate, vnSavedAt } from './format-time';

describe('mốc kỳ theo giờ VN', () => {
  it('hạn 2026-11-10T17:00Z = 00:00 ngày 11/11 giờ VN: khóa "11/11", ngày cuối 10', () => {
    expect(vnLockDate('2026-11-10T17:00:00.000Z')).toBe('11/11');
    expect(vnDeadlineDay('2026-11-10T17:00:00.000Z')).toBe(10);
  });

  it('hạn cuối năm 2026-12-31T17:00Z → khóa "1/1", ngày cuối 31', () => {
    expect(vnLockDate('2026-12-31T17:00:00.000Z')).toBe('1/1');
    expect(vnDeadlineDay('2026-12-31T17:00:00.000Z')).toBe(31);
  });
});

describe('vnSavedAt — "hh:mm hôm nay" / "dd/MM · hh:mm"', () => {
  const now = new Date('2026-11-05T10:00:00.000Z');
  it('cùng ngày VN → today + giờ', () => {
    expect(vnSavedAt('2026-11-05T07:20:00.000Z', now)).toEqual({ today: true, time: '14:20', date: '05/11' });
  });

  it('23:59:59 VN hôm trước → không phải hôm nay; 00:00 VN hôm nay → hôm nay', () => {
    expect(vnSavedAt('2026-11-04T16:59:59.000Z', now).today).toBe(false);
    expect(vnSavedAt('2026-11-04T17:00:00.000Z', now)).toEqual({ today: true, time: '00:00', date: '05/11' });
  });
});
