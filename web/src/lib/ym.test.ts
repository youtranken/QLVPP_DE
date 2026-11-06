import { describe, expect, it } from 'vitest';
import { YM, lockedYm, shiftYm, vnYmNow } from '@/lib/ym';

describe('ym', () => {
  it('lockedYm = kỳ liền trước kỳ đang mở, qua năm đúng', () => {
    expect(lockedYm('2026-11')).toBe('2026-10');
    expect(lockedYm('2027-01')).toBe('2026-12');
  });


  it('YM nhận tháng 01–12, từ chối 00/13/1 chữ số', () => {
    expect(['2026-01', '2026-12'].every((s) => YM.test(s))).toBe(true);
    expect(['2026-00', '2026-13', '2026-1', 'abc'].some((s) => YM.test(s))).toBe(false);
  });

  it('năm ≥ 2000 như api: 1999-12 và 0000-01 không hợp lệ, 2000-01 hợp lệ', () => {
    expect(YM.test('1999-12')).toBe(false);
    expect(YM.test('0000-01')).toBe(false);
    expect(YM.test('2000-01')).toBe(true);
  });

  it('shiftYm qua năm: 2026-12 +1 → 2027-01, 2026-01 −1 → 2025-12', () => {
    expect(shiftYm('2026-12', 1)).toBe('2027-01');
    expect(shiftYm('2026-01', -1)).toBe('2025-12');
    expect(shiftYm('2026-11', 1)).toBe('2026-12');
  });

  it('vnYmNow: 16:59:59Z ngày 30/11 vẫn là 2026-11, 17:00:00Z đã là 2026-12 (UTC+7)', () => {
    expect(vnYmNow(new Date('2026-11-30T16:59:59Z'))).toBe('2026-11');
    expect(vnYmNow(new Date('2026-11-30T17:00:00Z'))).toBe('2026-12');
    expect(vnYmNow(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01');
  });
});
