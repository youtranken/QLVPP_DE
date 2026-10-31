import { describe, expect, it } from 'vitest';
import { dateRangeInvalid, quickRanges, vnDayKey } from './audit-quick-ranges';

describe('vnDayKey', () => {
  it('16:59:59.999 UTC vẫn là ngày cũ ở VN, 17:00:00.000 UTC đã sang ngày mới', () => {
    expect(vnDayKey(new Date('2026-10-28T16:59:59.999Z'))).toBe('2026-10-28');
    expect(vnDayKey(new Date('2026-10-28T17:00:00.000Z'))).toBe('2026-10-29');
  });
});

describe('quickRanges', () => {
  it('"Hôm nay" lúc 23:30 UTC = ngày kế tiếp theo giờ VN', () => {
    const r = quickRanges(new Date('2026-10-28T23:30:00.000Z'));
    expect(r.today).toEqual({ from: '2026-10-29', to: '2026-10-29' });
  });

  it('"7 ngày qua" gồm hôm nay và 6 ngày trước, qua ranh giới tháng', () => {
    expect(quickRanges(new Date('2026-11-03T05:00:00.000Z')).week).toEqual({ from: '2026-10-28', to: '2026-11-03' });
  });

  it('tháng hiện tại theo giờ VN: 17:00 UTC ngày cuối tháng đã là tháng sau', () => {
    expect(quickRanges(new Date('2026-10-31T16:59:59.999Z')).month).toEqual({ from: '2026-10-01', to: '2026-10-31', month: 10, year: 2026 });
    expect(quickRanges(new Date('2026-10-31T17:00:00.000Z')).month).toEqual({ from: '2026-11-01', to: '2026-11-30', month: 11, year: 2026 });
  });

  it('tháng 2 năm nhuận kết thúc ngày 29, năm thường ngày 28', () => {
    expect(quickRanges(new Date('2028-02-10T05:00:00.000Z')).month.to).toBe('2028-02-29');
    expect(quickRanges(new Date('2027-02-10T05:00:00.000Z')).month.to).toBe('2027-02-28');
  });
});

describe('dateRangeInvalid', () => {
  it('Đến ngày bằng Từ ngày hợp lệ; sớm hơn 1 ngày thì sai; thiếu một đầu thì không kiểm', () => {
    expect(dateRangeInvalid('2026-10-20', '2026-10-20')).toBe(false);
    expect(dateRangeInvalid('2026-10-20', '2026-10-19')).toBe(true);
    expect(dateRangeInvalid('2026-10-20', '')).toBe(false);
    expect(dateRangeInvalid('', '2026-10-19')).toBe(false);
  });
});
