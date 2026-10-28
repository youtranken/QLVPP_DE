import {
  addMonths,
  daysLeft,
  deadlineOf,
  periodFor,
  vnDate,
  ymToDate,
} from './period';

const at = (iso: string) => new Date(iso);

describe('periodFor', () => {
  it('23:59:59 ngày 10 VN còn kỳ tháng này', () => {
    expect(periodFor(at('2026-11-10T16:59:59Z'), 10)).toBe('2026-11');
  });
  it('00:00 ngày 11 VN sang kỳ tháng sau', () => {
    expect(periodFor(at('2026-11-10T17:00:00Z'), 10)).toBe('2026-12');
  });
  it('qua năm', () => {
    expect(periodFor(at('2026-12-10T17:00:00Z'), 10)).toBe('2027-01');
  });
});

describe('deadlineOf', () => {
  it('00:00 ngày 11 VN', () => {
    expect(deadlineOf('2026-11', 10)).toEqual(at('2026-11-10T17:00:00Z'));
  });
  it('lastDay 28 tháng 2 → 00:00 ngày 1/3 VN', () => {
    expect(deadlineOf('2027-02', 28)).toEqual(at('2027-02-28T17:00:00Z'));
  });
  it('năm nhuận: lastDay 28 tháng 2/2028 → 00:00 ngày 29/2 VN', () => {
    expect(deadlineOf('2028-02', 28)).toEqual(at('2028-02-28T17:00:00Z'));
  });
  it('tháng 12', () => {
    expect(deadlineOf('2026-12', 10)).toEqual(at('2026-12-10T17:00:00Z'));
    expect(deadlineOf('2026-12', 28)).toEqual(at('2026-12-28T17:00:00Z'));
  });
});

describe('daysLeft', () => {
  const nov = deadlineOf('2026-11', 10);
  it('ngày 6 → 5', () => {
    // còn 23:59 đêm 05/11 VN (mốc 16:59Z) vẫn là ngày 5 → 6
    expect(daysLeft(at('2026-11-05T16:59:59Z'), nov)).toBe(6);
    expect(
      daysLeft(
        at('2026-11-06T03:00:00Z' /* 06/11 VN 10:00; brief ghi nhầm 05T */),
        nov,
      ),
    ).toBe(5);
  });
  it('ngày hạn → 1', () => {
    expect(daysLeft(at('2026-11-10T03:00:00Z'), nov)).toBe(1);
    expect(daysLeft(at('2026-11-10T16:59:59.999Z'), nov)).toBe(1);
  });
  it('14/11 tới hạn 10/12 → 27', () => {
    expect(
      daysLeft(at('2026-11-14T03:00:00Z'), deadlineOf('2026-12', 10)),
    ).toBe(27);
  });
  it('sau hạn → 0', () => {
    expect(daysLeft(at('2026-11-10T17:00:00Z'), nov)).toBe(0);
    expect(daysLeft(at('2026-11-14T03:00:00Z'), nov)).toBe(0);
  });
});

describe('addMonths', () => {
  it('qua năm hai chiều', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('vnDate', () => {
  it('mốc UTC lệch ngày', () => {
    expect(vnDate(at('2026-11-10T17:00:00Z'))).toEqual({
      y: 2026,
      m: 11,
      d: 11,
    });
  });
});

describe('ymToDate', () => {
  it('ngày 1 của tháng', () => {
    expect(ymToDate('2026-11')).toBe('2026-11-01');
  });
});
