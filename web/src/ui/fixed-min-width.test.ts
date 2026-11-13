import { describe, expect, it } from 'vitest';
import { fixedMinWidth } from './fixed-min-width';

describe('fixedMinWidth', () => {
  it('cộng rem/px đủ, cột % 6rem, cột không đặt 12rem, ô chọn 2.75rem (vùng bấm 44px); làm tròn lên 0.5rem', () => {
    expect(fixedMinWidth([undefined, '5.5rem', '64px', '15%'], false)).toBe(27.5);
    expect(fixedMinWidth([undefined, '3.3rem'], true)).toBe(18.5);
  });

  it('cột chữ chính có sàn riêng (Danh bạ: Họ tên 13rem) thì cộng sàn đó thay 12rem', () => {
    expect(fixedMinWidth([undefined, '5.5rem'], false, ['13rem', undefined])).toBe(18.5);
    expect(fixedMinWidth([undefined, '5.5rem'], false, [undefined, undefined])).toBe(17.5);
  });
});
