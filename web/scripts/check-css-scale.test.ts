import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findScaleIssues, formatIssue, isChecked, isStrict, readScale, scanProject } from './check-css-scale.mjs';

const TOKENS = `:root {
  --t-h1: 800 28px/1.2 var(--font); --t-h3: 700 18px/1.3 var(--font); --t-body-l: 500 16px/1.5 var(--font);
  --t-body: 500 14px/1.5 var(--font); --t-sm: 500 13px/1.45 var(--font); --t-cap: 600 12px/1.35 var(--font);
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-7: 32px; --s-8: 40px; --s-9: 56px;
}`;
const scale = readScale(TOKENS);
const issues = (css: string, strict = true) => findScaleIssues('a.css', css, scale, strict).map((i) => `${i.prop}: ${i.value}`);

function withProject(files: Record<string, string>, run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'css-scale-'));
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

describe('check-css-scale', () => {
  it('đọc thang từ tokens-m1: cỡ chữ của --t-*, khoảng cách của --s-* (kèm 0/1/2px nét mảnh)', () => {
    expect([...scale.fontSizes].sort((a, b) => a - b)).toEqual([12, 13, 14, 16, 18, 28]);
    expect([...scale.spacing].sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 56]);
  });

  it('font-size: 12.5px → báo (cỡ lẻ .5), kèm số dòng', () => {
    const found = findScaleIssues('a.css', '.a { color: red; }\n.b { font-size: 12.5px; }\n', scale, false);
    expect(found).toEqual([{ file: 'a.css', line: 2, prop: 'font-size', value: '12.5px' }]);
  });

  it('gap: 10px → báo; gap: 8px / 12px (hai phía mốc) và var(--s-3) → sạch', () => {
    expect(issues('.a { gap: 10px; } .b { gap: 8px; } .c { gap: 12px; } .d { gap: var(--s-3); }')).toEqual(['gap: 10px']);
  });

  it('padding/margin nhiều giá trị: chỉ báo giá trị ngoài thang (14px, 6px), kể cả trong calc và số âm', () => {
    expect(
      issues('.a { padding: 12px 14px; } .b { margin: -6px 0 4px; } .c { padding-bottom: calc(16px + env(x)); } .d { margin-inline: -8px; }'),
    ).toEqual(['padding: 14px', 'margin: 6px']);
  });

  it('nét mảnh 1px/2px và kích thước bố cục > 56px (khoảng chừa thanh dưới, ngăn kéo) → sạch; 57px trở xuống mà ngoài thang → báo', () => {
    expect(issues('.a { padding: 1px 2px; } .b { padding-right: var(--w, 384px); } .c { padding-bottom: calc(88px + 1px); } .d { gap: 54px; }')).toEqual([
      'gap: 54px',
    ]);
  });

  it('tệp chặt (admin M1): font-size px ngoài thang token (15px, 11px) → báo; 13px/16px trong thang → sạch', () => {
    expect(issues('.a { font-size: 15px; } .b { font-size: 11px; } .c { font-size: 13px; } .d { font-size: 16px; }')).toEqual([
      'font-size: 15px',
      'font-size: 11px',
    ]);
  });

  it('tệp không chặt (giao diện nhân viên cũ): cỡ chẵn ngoài thang (15px) → sạch, nhưng .5 vẫn báo', () => {
    expect(issues('.a { font-size: 15px; } .b { font-size: 13.5px; }', false)).toEqual(['font-size: 13.5px']);
  });

  it('font shorthand với px → kiểm cỡ chữ; bỏ qua comment và khai báo --t-* trong tokens', () => {
    expect(issues('/* gap: 10px */ .a { font: 700 12.5px/1.3 var(--font); }')).toEqual(['font: 12.5px']);
    expect(findScaleIssues('tokens-m1.css', TOKENS, scale, true)).toEqual([]);
  });

  it('isChecked: src/css/** và features/**/*.m1.css; isStrict: chỉ m1', () => {
    expect(isChecked(join('src', 'css', 'base.css'))).toBe(true);
    expect(isChecked(join('src', 'css', 'm1', 'shell.css'))).toBe(true);
    expect(isChecked(join('src', 'features', 'units', 'units.m1.css'))).toBe(true);
    expect(isChecked(join('src', 'features', 'request', 'request.css'))).toBe(false);
    expect(isStrict(join('src', 'css', 'm1', 'shell.css'))).toBe(true);
    expect(isStrict(join('src', 'css', 'tokens-m1.css'))).toBe(true);
    expect(isStrict(join('src', 'features', 'units', 'units.m1.css'))).toBe(true);
    expect(isStrict(join('src', 'css', 'member.css'))).toBe(false);
  });

  it('scanProject + chạy script: báo đường dẫn tương đối, thoát 1 khi có lỗi, 0 khi sạch', () => {
    withProject(
      {
        'src/css/tokens-m1.css': TOKENS,
        'src/css/m1/base.css': '.a { gap: 10px; }\n',
        'src/features/x/x.m1.css': '.b { font-size: 12.5px; }\n',
        'src/features/x/x.css': '.c { gap: 10px; }\n',
      },
      (root) => {
        const found = scanProject(root);
        expect(found.map(formatIssue)).toEqual([
          `${join('src', 'css', 'm1', 'base.css')}:1 gap: 10px — ngoài thang token`,
          `${join('src', 'features', 'x', 'x.m1.css')}:1 font-size: 12.5px — ngoài thang token`,
        ]);
        const res = spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'check-css-scale.mjs'), root], { encoding: 'utf8' });
        expect(res.status).toBe(1);
        expect(res.stderr).toContain('gap: 10px');
      },
    );
    withProject({ 'src/css/tokens-m1.css': TOKENS, 'src/css/m1/base.css': '.a { gap: var(--s-3); }\n' }, (root) => {
      const res = spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'check-css-scale.mjs'), root], { encoding: 'utf8' });
      expect(res.status).toBe(0);
    });
  });
});
