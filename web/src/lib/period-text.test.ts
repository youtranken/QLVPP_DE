import { describe, expect, it } from 'vitest';
import { lockPhrase } from './period-text';

describe('lockPhrase — một câu khóa sổ (khoảng trắng không ngắt: không gãy dòng giữa cụm)', () => {
  it('hạn 2026-11-10T17:00Z → "00:00 ngày 11/11" (vi) / "00:00 on 11/11" (en)', () => {
    expect(lockPhrase('2026-11-10T17:00:00.000Z', 'vi')).toBe('00:00\u00a0ngày\u00a011/11');
    expect(lockPhrase('2026-11-10T17:00:00.000Z', 'en')).toBe('00:00\u00a0on\u00a011/11');
  });

  it('một mili giây trước hạn vẫn là ngày của chính deadline, không đổi theo mốc đầu vào', () => {
    expect(lockPhrase('2026-11-10T16:59:59.999Z', 'vi')).toBe('00:00\u00a0ngày\u00a010/11');
  });

  it('qua năm: kỳ 2026-12, ngày cuối 5 → "00:00 ngày 06/01", có số 0 đầu', () => {
    expect(lockPhrase('2027-01-05T17:00:00.000Z', 'vi')).toBe('00:00\u00a0ngày\u00a006/01');
  });

  it.each(['America/Los_Angeles', 'Pacific/Kiritimati'])('TZ máy %s vẫn ra 11/11', (tz) => {
    const before = process.env.TZ;
    process.env.TZ = tz;
    try {
      expect(lockPhrase('2026-11-10T17:00:00.000Z', 'vi')).toBe('00:00\u00a0ngày\u00a011/11');
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });
});
