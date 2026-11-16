import { describe, expect, it } from 'vitest';
import { vnDeadlineDay, vnSavedAt, vnSavedStamp } from './format-time';

describe('mốc kỳ theo giờ VN', () => {
  it('hạn 2026-11-10T17:00Z = 00:00 ngày 11/11 giờ VN: ngày cuối 10', () => {
    expect(vnDeadlineDay('2026-11-10T17:00:00.000Z')).toBe(10);
  });

  it('hạn cuối năm 2026-12-31T17:00Z → ngày cuối 31', () => {
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

describe('vnSavedStamp — một cách viết giờ lưu cho Kỳ tháng, Xem phiếu, Điều chỉnh', () => {
  it('"14/11 · 19:18" theo giờ VN (12:18Z), cả khi là hôm nay', () => {
    expect(vnSavedStamp('2026-11-14T12:18:00.000Z')).toBe('14/11 · 19:18');
    expect(vnSavedStamp('2026-11-13T17:00:00.000Z')).toBe('14/11 · 00:00');
  });
});
