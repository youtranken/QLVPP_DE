import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findHardcodedText, formatFinding, isChecked, scanProject } from './check-hardcoded-text.mjs';

const scan = (source: string, file = 'mau.tsx') => findHardcodedText(file, source).map((f) => f.text);

function withProject(files: Record<string, string>, run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'hardcoded-'));
  try {
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

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

  it('kiểm .ts và .tsx trong src; bỏ *.test.ts(x), *.d.ts, src/locales, src/test', () => {
    expect(isChecked('src/features/request/request-page.test.tsx')).toBe(false);
    expect(isChecked('src/features/request/use-cart.test.ts')).toBe(false);
    expect(isChecked('src/vite-env.d.ts')).toBe(false);
    expect(isChecked(join('src', 'locales', 'vi', 'request.ts'))).toBe(false);
    expect(isChecked(join('src', 'test', 'fixtures-me.ts'))).toBe(false);
    expect(isChecked(join('src', 'features', 'review', 'review-fixtures.ts'))).toBe(false);
    expect(isChecked('src/lib/ym.ts')).toBe(true);
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

  it('prop chuỗi của component bất kỳ (heading, emptyText) có chữ → báo; prop kỹ thuật (variant, tone, type, to, path, d, *ClassName) → sạch', () => {
    expect(
      scan(
        `export const A = () => (<Hero heading="Kỳ tháng 11" emptyText="Empty"><Button variant="primary" size="sm" type="button" tone="warn" mode="adjust" /><Link to="/me" /><Route path="history" /><path d="M0 0L1 1" /><Dialog overlayClassName="a-scrim" /></Hero>);`,
      ),
    ).toEqual(['Kỳ tháng 11', 'Empty']);
  });

  it('aria-* có chữ (aria-roledescription, aria-valuetext) → báo; aria-hidden/live/current/labelledby → sạch', () => {
    expect(
      scan(
        `export const A = () => (<div aria-roledescription="thẻ" aria-valuetext="Ba món" aria-hidden="true" aria-live="polite" aria-current="page" aria-labelledby="t1" />);`,
      ),
    ).toEqual(['thẻ', 'Ba món']);
  });

  it('template chỉ có biến và đơn vị (${n}px, ${p}%, ${a}px ${b}rem) → sạch; template có chữ → vẫn báo', () => {
    expect(scan('export const A = () => <p title={`${n}px`}>{`${p}%`}{`${a}px ${b}rem`}{`${n} món`}</p>;')).toEqual([
      '${…} món',
    ]);
  });

  it('tệp .ts: chuỗi có chữ tiếng Việt có dấu → báo; chuỗi ASCII kỹ thuật → sạch', () => {
    expect(
      scan(
        "export const label = 'Đã lưu';\nexport const key = 'request.toast.saved';\nconst x = new Map<string, number>();\n",
        'src/lib/x.ts',
      ),
    ).toEqual(['Đã lưu']);
  });

  it("toast/showToast/setToast với chuỗi có chữ (kể cả tiếng Anh) → báo; với t('…') → sạch", () => {
    expect(
      scan("showToast('Saved');\nsetToast(`Copied ${n}`);\nshowToast(t('request.toast.saved'));\n", 'src/features/x.ts'),
    ).toEqual(['Saved', 'Copied ${…}']);
  });

  it('chuỗi tiếng Việt ngoài JSX trong .tsx (hằng số nhãn) → báo một lần', () => {
    expect(scan("const LABELS = { a: 'Chờ duyệt' };\nexport const A = () => <p title={'Mở'} />;\n")).toEqual([
      'Chờ duyệt',
      'Mở',
    ]);
  });

  it('chạy script qua symlink (lint từ đường dẫn symlink) vẫn quét và thoát 1 khi có chuỗi cứng', () => {
    withProject({ 'src/a.tsx': 'export const A = () => <p>Lưu phiếu</p>;\n' }, (root) => {
      const link = join(root, 'check-link.mjs');
      symlinkSync(join(process.cwd(), 'scripts', 'check-hardcoded-text.mjs'), link);
      const res = spawnSync(process.execPath, [link, root], { encoding: 'utf8' });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('chuỗi cứng "Lưu phiếu"');
    });
  });

  it('scanProject duyệt src/: báo tệp .tsx có chữ cứng (đường dẫn tương đối + dòng), bỏ *.test.tsx và locales', () => {
    withProject(
      {
        'src/features/a.tsx': 'export const A = () => (\n  <p>Lưu phiếu</p>\n);\n',
        'src/features/a.test.tsx': 'const x = <p>Chữ trong test</p>;\n',
        'src/locales/vi/a.ts': "export default { a: 'Chữ' };\n",
        'src/b.ts': "export const s = 'Chữ';\n",
        'src/c.tsx': "export const C = () => <p>{t('c')}</p>;\n",
      },
      (root) => {
        const findings = scanProject(root);
        expect(findings).toEqual([
          { file: join('src', 'b.ts'), line: 1, text: 'Chữ' },
          { file: join('src', 'features', 'a.tsx'), line: 2, text: 'Lưu phiếu' },
        ]);
        expect(findings.map(formatFinding)[1]).toBe(`${join('src', 'features', 'a.tsx')}:2 chuỗi cứng "Lưu phiếu" — dùng t()`);
      },
    );
  });
});
