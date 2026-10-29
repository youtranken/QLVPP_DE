import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findHardcodedText, formatFinding, isChecked, scanProject } from './check-hardcoded-text.mjs';

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
    <span>·</span> <b>{n}</b> <span>—</span> <span>×</span> <span>&times;</span> <span>&#215;</span> <span>&nbsp;</span>
  </div>
);`),
    ).toEqual([]);
  });

  it('*.test.tsx và tệp không phải .tsx không bị kiểm', () => {
    expect(isChecked('src/features/request/request-page.test.tsx')).toBe(false);
    expect(isChecked('src/lib/ym.ts')).toBe(false);
    expect(isChecked('src/features/request/period-hero.tsx')).toBe(true);
  });

  it('fragment <>{…}</> có chữ cứng → báo', () => {
    expect(scan("export const A = () => <>{'Chưa lưu'}</>;")).toEqual(['Chưa lưu']);
  });

  it("thuộc tính dạng biểu thức title={'Đóng'}, alt={`Ảnh`} → báo; className={'…'} → sạch", () => {
    expect(scan("export const A = () => <img title={'Đóng'} alt={`Ảnh`} className={'anh lon'} />;")).toEqual([
      'Đóng',
      'Ảnh',
    ]);
  });

  it('template có biến {`Còn ${n} ngày`} → báo phần chữ', () => {
    expect(scan('export const A = () => <p>{`Còn ${n} ngày`}</p>;')).toEqual(['Còn ${…} ngày']);
  });

  it("ba ngôi {x ? 'Có' : 'Không'} và {x && 'Mới'} → báo từng nhánh; nhánh t() → sạch", () => {
    expect(
      scan("export const A = () => <p title={x ? 'Mở' : t('a')}>{x ? 'Có' : 'Không'}{y && 'Mới'}{z ? t('b') : null}</p>;"),
    ).toEqual(['Mở', 'Có', 'Không', 'Mới']);
  });

  it('scanProject duyệt src/: báo tệp .tsx có chữ cứng (đường dẫn tương đối + dòng), bỏ *.test.tsx và .ts', () => {
    const root = mkdtempSync(join(tmpdir(), 'hardcoded-'));
    try {
      mkdirSync(join(root, 'src', 'features'), { recursive: true });
      writeFileSync(join(root, 'src', 'features', 'a.tsx'), 'export const A = () => (\n  <p>Lưu phiếu</p>\n);\n');
      writeFileSync(join(root, 'src', 'features', 'a.test.tsx'), 'const x = <p>Chữ trong test</p>;\n');
      writeFileSync(join(root, 'src', 'b.ts'), "export const s = 'Chữ';\n");
      writeFileSync(join(root, 'src', 'c.tsx'), "export const C = () => <p>{t('c')}</p>;\n");
      const findings = scanProject(root);
      expect(findings).toEqual([{ file: join('src', 'features', 'a.tsx'), line: 2, text: 'Lưu phiếu' }]);
      expect(findings.map(formatFinding)).toEqual([
        `${join('src', 'features', 'a.tsx')}:2 chuỗi cứng "Lưu phiếu" — dùng t()`,
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
