import { describe, expect, it } from 'vitest';
import { isoToDmy, parseDmy } from './dmy-date';

describe('parseDmy — ngày dd/mm/yyyy không phụ thuộc locale trình duyệt', () => {
  it.each([
    ['31/12/2026', '2026-12-31'],
    ['01/01/2027', '2027-01-01'],
    ['1/1/2027', '2027-01-01'],
    ['29/02/2028', '2028-02-29'],
    ['28/02/2027', '2027-02-28'],
    ['30/04/2026', '2026-04-30'],
    ['01/01/2000', '2000-01-01'],
    ['31/12/9999', '9999-12-31'],
    ['  05/11/2026 ', '2026-11-05'],
    ['31122026', '2026-12-31'],
    ['29022028', '2028-02-29'],
  ])('"%s" hợp lệ → %s', (text, iso) => {
    expect(parseDmy(text)).toEqual({ kind: 'ok', iso });
  });

  it.each([
    ['31/02/2026', 'ngày 31 tháng 2'],
    ['29/02/2027', '2027 không nhuận'],
    ['31/04/2026', 'tháng 4 có 30 ngày'],
    ['32/12/2026', 'ngày 32'],
    ['00/01/2027', 'ngày 0'],
    ['01/13/2026', 'tháng 13'],
    ['01/00/2026', 'tháng 0'],
    ['31/12/1999', 'trước năm 2000 (api chặn DATE_FROM_2000)'],
    ['01/01/26', 'năm 2 chữ số'],
    ['2026-12-31', 'kiểu ISO'],
    ['12/31/2026', 'kiểu Mỹ mm/dd'],
    ['abc', 'chữ'],
    ['29022027', '8 chữ số nhưng 2027 không nhuận'],
    ['3112202', '7 chữ số'],
  ])('"%s" sai (%s) → invalid', (text) => {
    expect(parseDmy(text)).toEqual({ kind: 'invalid' });
  });

  it('rỗng hoặc chỉ khoảng trắng → empty', () => {
    expect(parseDmy('')).toEqual({ kind: 'empty' });
    expect(parseDmy('   ')).toEqual({ kind: 'empty' });
  });

  it('isoToDmy: 2026-12-31 → 31/12/2026; rỗng → rỗng; chuỗi không phải ISO giữ nguyên', () => {
    expect(isoToDmy('2026-12-31')).toBe('31/12/2026');
    expect(isoToDmy('')).toBe('');
    expect(isoToDmy('2026-02-30')).toBe('30/02/2026');
    expect(isoToDmy('xyz')).toBe('xyz');
  });
});
