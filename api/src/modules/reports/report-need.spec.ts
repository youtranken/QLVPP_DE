import { needOf } from './report-need';

describe('needOf (BR-15: max(0, đăng ký + nợ kỳ trước − tồn))', () => {
  it('đăng ký 5, đã giao 2 (còn 3), tồn 2 → cần 1', () => {
    expect(needOf(3, 0, 2)).toBe(1);
  });

  it('nợ 2 kỳ trước + đăng ký 3, tồn 0 → cần 5', () => {
    expect(needOf(3, 2, 0)).toBe(5);
  });

  it('tồn 10, đăng ký 3 → cần 0 (không âm)', () => {
    expect(needOf(3, 0, 10)).toBe(0);
  });

  it('biên: tồn đúng bằng tổng → 0; tồn = tổng − 1 → 1', () => {
    expect(needOf(3, 0, 3)).toBe(0);
    expect(needOf(3, 0, 2)).toBe(1);
    expect(needOf(2, 1, 3)).toBe(0);
    expect(needOf(2, 1, 2)).toBe(1);
  });

  it('ngoài danh mục (tồn null) không trừ tồn → đăng ký 4 + nợ 1 = 5', () => {
    expect(needOf(4, 1, null)).toBe(5);
  });

  it('không có gì cần → 0', () => {
    expect(needOf(0, 0, null)).toBe(0);
  });
});
