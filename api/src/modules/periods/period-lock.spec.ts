import { isLocked, lockPhraseVi, lockState } from './period-lock';

describe('một định nghĩa khóa sổ: isLocked(ym, now) ⇔ ym < kỳ mở', () => {
  it('kỳ 2026-11 (hạn ngày 10): 16:59:59.999Z ngày 10 còn mở, 17:00:00.000Z đã khóa', () => {
    expect(isLocked('2026-11', new Date('2026-11-10T16:59:59.999Z'), 10)).toBe(
      false,
    );
    expect(isLocked('2026-11', new Date('2026-11-10T17:00:00.000Z'), 10)).toBe(
      true,
    );
  });

  it('qua năm với registration_last_day = 5: 2026-12 khóa đúng 17:00Z ngày 05/12, 2027-01 khóa đúng 17:00Z ngày 05/01', () => {
    expect(isLocked('2026-12', new Date('2026-12-05T16:59:59.999Z'), 5)).toBe(
      false,
    );
    expect(isLocked('2026-12', new Date('2026-12-05T17:00:00.000Z'), 5)).toBe(
      true,
    );
    expect(isLocked('2027-01', new Date('2027-01-05T16:59:59.999Z'), 5)).toBe(
      false,
    );
    expect(isLocked('2027-01', new Date('2027-01-05T17:00:00.000Z'), 5)).toBe(
      true,
    );
  });

  it('kỳ trước kỳ mở luôn khóa, kỳ sau kỳ mở không khóa', () => {
    const now = new Date('2026-11-05T03:00:00Z');
    expect(isLocked('2026-10', now, 10)).toBe(true);
    expect(isLocked('2026-12', now, 10)).toBe(false);
  });

  it('lockState so với kỳ mở: trước → locked, bằng → open, sau → future (qua năm)', () => {
    expect(lockState('2026-12', '2027-01')).toBe('locked');
    expect(lockState('2027-01', '2027-01')).toBe('open');
    expect(lockState('2027-02', '2027-01')).toBe('future');
  });

  it('câu khóa sổ theo giờ VN của deadline: 2026-11-10T17:00Z → "00:00 ngày 11/11"; 2027-01-05T17:00Z → "00:00 ngày 06/01"', () => {
    expect(lockPhraseVi(new Date('2026-11-10T17:00:00.000Z'))).toBe(
      '00:00 ngày 11/11',
    );
    expect(lockPhraseVi(new Date('2027-01-05T17:00:00.000Z'))).toBe(
      '00:00 ngày 06/01',
    );
  });
});
