import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { deadlineFor, effectiveSentence } from './effective-period';

const t = i18n.getFixedT('vi');

describe('effectiveSentence — câu kỳ áp dụng của hạn mới', () => {
  it('kỳ mở 01/2027 hạn 10 → 8', () => {
    expect(effectiveSentence(t, 'vi', { ym: '2027-01', deadline: '2027-01-10T17:00:00.000Z' }, '8')).toBe(
      'Kỳ tháng 01 (đang mở) vẫn khóa 00:00\u00a0ngày\u00a011/01. Áp dụng từ kỳ tháng 02: khóa 00:00\u00a0ngày\u00a009/02.',
    );
  });

  it('qua năm: kỳ mở 12/2026 → áp dụng từ kỳ tháng 01', () => {
    expect(effectiveSentence(t, 'vi', { ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z' }, '5')).toBe(
      'Kỳ tháng 12 (đang mở) vẫn khóa 00:00\u00a0ngày\u00a011/12. Áp dụng từ kỳ tháng 01: khóa 00:00\u00a0ngày\u00a006/01.',
    );
  });

  it.each([
    ['28', 'khóa 00:00\u00a0ngày\u00a001/03.'],
    ['3', 'khóa 00:00\u00a0ngày\u00a004/02.'],
  ])('biên ô hạn 3–28 (kỳ sau là tháng 2 có 28 ngày): %s → %s', (day, tail) => {
    expect(effectiveSentence(t, 'vi', { ym: '2027-01', deadline: '2027-01-10T17:00:00.000Z' }, day)).toMatch(new RegExp(`${tail}$`));
  });

  it.each(['2', '29', '', '8.5'])('ô hạn ngoài 3–28 (%s) → chỉ nửa câu kỳ đang mở', (day) => {
    expect(effectiveSentence(t, 'vi', { ym: '2027-01', deadline: '2027-01-10T17:00:00.000Z' }, day)).toBe('Kỳ tháng 01 (đang mở) vẫn khóa 00:00\u00a0ngày\u00a011/01.');
  });

  it('mốc khóa theo hạn: 17:00 UTC ngày hạn (00:00 VN ngày sau)', () => {
    expect(deadlineFor('2027-02', 8)).toBe('2027-02-08T17:00:00.000Z');
  });

  it('en', () => {
    expect(effectiveSentence(i18n.getFixedT('en'), 'en', { ym: '2027-01', deadline: '2027-01-10T17:00:00.000Z' }, '8')).toBe(
      'Period 01 (open) still locks at 00:00\u00a0on\u00a011/01. From period 02: locks at 00:00\u00a0on\u00a009/02.',
    );
  });
});
