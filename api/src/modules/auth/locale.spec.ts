import {
  normalizeLocale,
  normalizeLocaleUpdatedAt,
  parseLocaleTag,
  parseUiLocales,
} from './locale';

describe('locale (docs 7a)', () => {
  it('normalizeLocale: vi/en/en-US/en_US; thiếu hoặc lạ → vi', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('EN-us')).toBe('en');
    expect(normalizeLocale('en_US')).toBe('en');
    expect(normalizeLocale('vi-VN')).toBe('vi');
    expect(normalizeLocale(undefined)).toBe('vi');
    expect(normalizeLocale(null)).toBe('vi');
    expect(normalizeLocale('fr')).toBe('vi');
    expect(normalizeLocale(42)).toBe('vi');
  });

  it('normalizeLocaleUpdatedAt: số giây ≥ 0 (làm tròn xuống); còn lại null', () => {
    expect(normalizeLocaleUpdatedAt(1_700_000_000)).toBe(1_700_000_000);
    expect(normalizeLocaleUpdatedAt(1_700_000_000.9)).toBe(1_700_000_000);
    expect(normalizeLocaleUpdatedAt(null)).toBeNull();
    expect(normalizeLocaleUpdatedAt(undefined)).toBeNull();
    expect(normalizeLocaleUpdatedAt('1700000000')).toBeNull();
    expect(normalizeLocaleUpdatedAt(-1)).toBeNull();
    expect(normalizeLocaleUpdatedAt(Number.NaN)).toBeNull();
  });

  it('parseLocaleTag: chặt — khoảng trắng, quá dài, ký tự lạ → undefined', () => {
    expect(parseLocaleTag('en')).toBe('en');
    expect(parseLocaleTag('vi')).toBe('vi');
    expect(parseLocaleTag('en vi')).toBeUndefined();
    expect(parseLocaleTag('x'.repeat(36))).toBeUndefined();
    expect(parseLocaleTag('en\r\nX: y')).toBeUndefined();
    expect(parseLocaleTag('fr')).toBeUndefined();
    expect(parseLocaleTag(1)).toBeUndefined();
  });

  it('parseUiLocales: lấy thẻ hỗ trợ đầu tiên; không có / quá dài → undefined', () => {
    expect(parseUiLocales('en')).toBe('en');
    expect(parseUiLocales('fr en-US vi')).toBe('en');
    expect(parseUiLocales('fr de')).toBeUndefined();
    expect(parseUiLocales('')).toBeUndefined();
    expect(parseUiLocales(undefined)).toBeUndefined();
    expect(parseUiLocales(['en'])).toBeUndefined();
    expect(parseUiLocales(`en ${'a'.repeat(100)}`)).toBeUndefined();
  });
});
