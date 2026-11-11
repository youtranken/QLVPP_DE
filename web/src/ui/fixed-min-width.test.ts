import { describe, expect, it } from 'vitest';
import { fixedMinWidth } from './fixed-min-width';

describe('fixedMinWidth', () => {
  it('cộng rem/px đủ, cột % 6rem, cột không đặt 12rem, ô chọn 2.5rem; làm tròn lên 0.5rem', () => {
    expect(fixedMinWidth([undefined, '5.5rem', '64px', '15%'], false)).toBe(27.5);
    expect(fixedMinWidth([undefined, '3.3rem'], true)).toBe(18);
  });
});
