import { describe, expect, it } from 'vitest';
import {
  checkWindowDays,
  describeWindow,
  formatPeriod,
  isRegistrationOpen,
  periodForDate,
  resolveWindow,
  type RegistrationWindow,
} from './period';

/** Khung mặc định: mở ngày 20, đóng khi hết tháng. */
const W: RegistrationWindow = { startDay: 20, endDay: 31 };
/** Khung có ngày đóng sớm, để phân biệt "đóng cửa sổ" với "sang kỳ sau". */
const W_2025: RegistrationWindow = { startDay: 20, endDay: 25 };

describe('resolveWindow — co theo số ngày thật của tháng', () => {
  it('tháng 31 ngày giữ nguyên', () => {
    expect(resolveWindow(W, new Date(2026, 7, 1))).toEqual({ start: 20, end: 31 }); // tháng 8
  });

  it('tháng 30 ngày co ngày đóng về 30', () => {
    expect(resolveWindow(W, new Date(2026, 3, 1))).toEqual({ start: 20, end: 30 }); // tháng 4
  });

  it('tháng 2 thường co về 28, năm nhuận co về 29', () => {
    expect(resolveWindow(W, new Date(2026, 1, 1))).toEqual({ start: 20, end: 28 });
    expect(resolveWindow(W, new Date(2028, 1, 1))).toEqual({ start: 20, end: 29 }); // nhuận
  });

  it('ngày MỞ cũng co, nếu không tháng 2 sẽ không bao giờ mở cửa sổ', () => {
    const muon: RegistrationWindow = { startDay: 30, endDay: 31 };
    expect(resolveWindow(muon, new Date(2026, 1, 1))).toEqual({ start: 28, end: 28 });
  });
});

describe('periodForDate — cửa sổ phục vụ THÁNG SAU', () => {
  it('trong cửa sổ → kỳ tháng sau', () => {
    expect(periodForDate(W, new Date(2026, 7, 20))).toBe('2026-09'); // 20/08 → kỳ 09
    expect(periodForDate(W, new Date(2026, 7, 31))).toBe('2026-09');
  });

  it('trước khi cửa sổ mở → vẫn là kỳ tháng hiện tại', () => {
    expect(periodForDate(W, new Date(2026, 7, 1))).toBe('2026-08');
    expect(periodForDate(W, new Date(2026, 7, 19))).toBe('2026-08');
  });

  it('sau khi cửa sổ đóng vẫn là kỳ tháng sau — kỳ đó đã đăng ký xong rồi', () => {
    expect(periodForDate(W_2025, new Date(2026, 7, 28))).toBe('2026-09');
  });

  it('cuộn năm khi tháng 12 sang tháng sau', () => {
    expect(periodForDate(W, new Date(2026, 11, 25))).toBe('2027-01');
  });

  it('tháng 2: ngày mở co lại nên kỳ vẫn chuyển đúng', () => {
    const muon: RegistrationWindow = { startDay: 30, endDay: 31 };
    expect(periodForDate(muon, new Date(2026, 1, 28))).toBe('2026-03');
    expect(periodForDate(muon, new Date(2026, 1, 27))).toBe('2026-02');
  });
});

describe('isRegistrationOpen', () => {
  it('mở đúng biên', () => {
    expect(isRegistrationOpen(W, new Date(2026, 7, 20))).toBe(true);
    expect(isRegistrationOpen(W, new Date(2026, 7, 31))).toBe(true);
  });

  it('đóng trước ngày mở', () => {
    expect(isRegistrationOpen(W, new Date(2026, 7, 19))).toBe(false);
    expect(isRegistrationOpen(W, new Date(2026, 7, 1))).toBe(false);
  });

  it('đóng sau ngày đóng', () => {
    expect(isRegistrationOpen(W_2025, new Date(2026, 7, 26))).toBe(false);
  });

  it('ngày cuối 31 nghĩa là đến hết tháng, tháng nào cũng vậy', () => {
    expect(isRegistrationOpen(W, new Date(2026, 1, 28))).toBe(true); // 28/02
    expect(isRegistrationOpen(W, new Date(2026, 3, 30))).toBe(true); // 30/04
  });
});

describe('checkWindowDays', () => {
  it('khung hợp lệ', () => {
    expect(checkWindowDays({ startDay: 1, endDay: 31 })).toBeNull();
    expect(checkWindowDays({ startDay: 20, endDay: 20 })).toBeNull();
  });

  it('từ chối ngày ngoài 1–31', () => {
    expect(checkWindowDays({ startDay: 0, endDay: 10 })).not.toBeNull();
    expect(checkWindowDays({ startDay: 1, endDay: 32 })).not.toBeNull();
  });

  it('từ chối ngày mở sau ngày đóng', () => {
    expect(checkWindowDays({ startDay: 20, endDay: 10 })).not.toBeNull();
  });

  it('từ chối ngày lẻ (không nguyên)', () => {
    expect(checkWindowDays({ startDay: 1.5, endDay: 10 })).not.toBeNull();
  });
});

describe('describeWindow', () => {
  it('ngày đóng 31 đọc là "hết tháng"', () => {
    expect(describeWindow(W)).toBe('từ ngày 20 đến hết tháng');
  });

  it('ngày đóng cụ thể đọc theo số', () => {
    expect(describeWindow(W_2025)).toBe('từ ngày 20 đến ngày 25');
  });
});

describe('formatPeriod', () => {
  it('định dạng tiếng Việt', () => {
    expect(formatPeriod('2026-08')).toBe('Tháng 8/2026');
  });
});
