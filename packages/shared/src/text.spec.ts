import { describe, expect, it } from 'vitest';
import { khongDau } from './text';

describe('khongDau', () => {
  it('bỏ dấu và hạ chữ thường', () => {
    expect(khongDau('Bút Bi Xanh')).toBe('but bi xanh');
    expect(khongDau('Đơn vị tính')).toBe('don vi tinh');
  });

  it('xử lý đủ nguyên âm có dấu tiếng Việt', () => {
    expect(khongDau('Mực máy in — Giấy A4')).toBe('muc may in — giay a4');
    expect(khongDau('ƯƠM ỄNH ỘP')).toBe('uom enh op');
  });

  it('cắt khoảng trắng thừa hai đầu', () => {
    expect(khongDau('  Sổ tay  ')).toBe('so tay');
  });

  it('chuỗi không dấu giữ nguyên (trừ chữ thường)', () => {
    expect(khongDau('A4')).toBe('a4');
  });
});
