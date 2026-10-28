import { BadRequestException } from '@nestjs/common';
import { parseYm } from './ym';

describe('parseYm', () => {
  it.each(['2026-10', '1999-01', '2026-12'])('%p hợp lệ → trả nguyên', (ym) => {
    expect(parseYm(ym)).toBe(ym);
  });

  it.each([
    '2026-13',
    '2026-00',
    '2026-1',
    '26-10',
    'abc',
    '',
    '2026-10x',
    ' 2026-10',
    undefined,
    ['2026-10'],
  ])('%p → 400 INVALID_PERIOD', (raw) => {
    let error: unknown;
    try {
      parseYm(raw);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'INVALID_PERIOD',
    });
  });
});
