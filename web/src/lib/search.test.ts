import { describe, expect, it } from 'vitest';
import { foldVi, matches, matchesSearch, normalizeSearch } from './search';

describe('search', () => {
  it('bỏ dấu, đ → d, chữ thường', () => {
    expect(foldVi('Đồ Bấm')).toBe('do bam');
    expect(normalizeSearch('Kẹp GIẤY')).toBe('kep giay');
  });

  it('matchesSearch: "but bi" khớp "Bút bi", "do bam" khớp "Đồ bấm", "bat" không khớp "Bút"', () => {
    expect(matchesSearch('Bút bi', 'but bi')).toBe(true);
    expect(matchesSearch('Đồ bấm', 'do bam')).toBe(true);
    expect(matchesSearch('Bút', 'bat')).toBe(false);
  });

  it('matches: tên vi, tên en, mã; ô trống khớp mọi món', () => {
    const item = { name: 'Kẹp giấy', name_en: 'Paper clip', code: 'K14' };
    expect(matches(item, 'kep')).toBe(true);
    expect(matches(item, 'clip')).toBe(true);
    expect(matches(item, 'k14')).toBe(true);
    expect(matches(item, '  ')).toBe(true);
    expect(matches(item, 'bút')).toBe(false);
    expect(matches({ name: 'Bút', name_en: null, code: null }, 'clip')).toBe(false);
  });
});
