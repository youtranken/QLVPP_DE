import { UNIT_CODE_MAX, unitCodeFrom } from './unit-code';

describe('unitCodeFrom', () => {
  it('"Cuộn" → cuon', () => {
    expect(unitCodeFrom('Cuộn', new Set())).toBe('cuon');
  });

  it('"Đôi" → doi (đ bỏ dấu thành d)', () => {
    expect(unitCodeFrom('Đôi', new Set())).toBe('doi');
  });

  it('"Cuốn" khi cuon đã có → cuon-2; khi cuon, cuon-2 đã có → cuon-3', () => {
    expect(unitCodeFrom('Cuốn', new Set(['cuon']))).toBe('cuon-2');
    expect(unitCodeFrom('Cuốn', new Set(['cuon', 'cuon-2']))).toBe('cuon-3');
  });

  it('ký tự lạ → "-", gộp liền nhau, không "-" ở đầu/cuối', () => {
    expect(unitCodeFrom('  Hộp (10 cái) / bó!  ', new Set())).toBe(
      'hop-10-cai-bo',
    );
  });

  it('tên 32 ký tự không dấu giữ đủ 32; 33 ký tự cắt còn 32', () => {
    expect(unitCodeFrom('a'.repeat(32), new Set())).toBe('a'.repeat(32));
    expect(unitCodeFrom('a'.repeat(33), new Set())).toBe('a'.repeat(32));
    expect(UNIT_CODE_MAX).toBe(32);
  });

  it('40 ký tự có dấu → ≤ 32 ký tự, không kết thúc bằng "-"', () => {
    const code = unitCodeFrom(
      'Thùng giấy cuộn lớn loại đặc biệt nhiều',
      new Set(),
    );
    expect(code.length).toBeLessThanOrEqual(32);
    expect(code).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('mã 32 ký tự đã có → thêm -2 mà vẫn ≤ 32', () => {
    const base = 'a'.repeat(32);
    const code = unitCodeFrom(base, new Set([base]));
    expect(code).toBe(`${'a'.repeat(30)}-2`);
  });

  it('tên không còn ký tự [a-z0-9] → "dvt"', () => {
    expect(unitCodeFrom('…', new Set())).toBe('dvt');
    expect(unitCodeFrom('…', new Set(['dvt']))).toBe('dvt-2');
  });
});
