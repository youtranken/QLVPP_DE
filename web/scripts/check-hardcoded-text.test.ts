import { describe, expect, it } from 'vitest';
import { findHardcodedText, isChecked } from './check-hardcoded-text.mjs';

const scan = (source: string) => findHardcodedText('mau.tsx', source).map((f) => f.text);

describe('check-hardcoded-text', () => {
  it('chữ tiếng Việt cứng trong JSX → báo lỗi kèm dòng', () => {
    const findings = findHardcodedText('mau.tsx', 'export const A = () => (\n  <p>Lưu phiếu</p>\n);\n');
    expect(findings).toEqual([{ file: 'mau.tsx', line: 2, text: 'Lưu phiếu' }]);
  });

  it('chuỗi qua t() → sạch', () => {
    expect(scan("export const A = () => <p title={t('a.b')}>{t('request.hero.title')}</p>;")).toEqual([]);
  });

  it('thuộc tính người dùng thấy (aria-label, title, placeholder, alt) có chữ cứng → báo; chuỗi trong {…} → báo', () => {
    expect(
      scan(
        `export const A = () => (<div><button aria-label="Đóng" /><input placeholder="Tìm món" title="Gợi ý" /><img alt="Ảnh" />{'Chưa lưu'}</div>);`,
      ),
    ).toEqual(['Đóng', 'Tìm món', 'Gợi ý', 'Ảnh', 'Chưa lưu']);
  });

  it('className, data-*, aria-hidden, comment và ký hiệu không chữ cái → sạch', () => {
    expect(
      scan(`export const A = () => (
  // Chú thích tiếng Việt
  <div className="rq-hero" data-testid="khung" aria-hidden="true">
    {/* Ghi chú trong JSX */}
    <span>·</span> <b>{n}</b> <span>—</span> <span>×</span>
  </div>
);`),
    ).toEqual([]);
  });

  it('*.test.tsx và tệp không phải .tsx không bị kiểm', () => {
    expect(isChecked('src/features/request/request-page.test.tsx')).toBe(false);
    expect(isChecked('src/lib/ym.ts')).toBe(false);
    expect(isChecked('src/features/request/period-hero.tsx')).toBe(true);
  });
});
