import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// TC-03: đang chọn chỉ có 3 kiểu — A rail (nền trắng 10%), B xem/lọc (nền xanh nhạt), C chọn một giá trị (xanh đặc).
// Nền tối --c-sel/--c-dark, nền trắng nổi, viền 2px cho trạng thái chọn đều bị cấm.
const root = resolve(process.cwd(), 'src');
const ALLOWED = [/var\(--c-acc-soft\)/, /var\(--c-acc\)/, /var\(--c-rail-on\)/, /transparent/, /none/];
const STATE = /\[aria-(pressed|checked|selected)='true'\]|\[aria-current(='[a-z]+')?\]|\.is-on\b|\.is-active\b/;

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? cssFiles(p) : n.endsWith('.css') ? [p] : [];
  });
}

type Rule = { file: string; selector: string; body: string };
function rules(): Rule[] {
  return cssFiles(root).flatMap((file) => {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ file: file.slice(root.length + 1), selector: m[1].trim(), body: m[2] }));
  });
}

// Vế selector mà phần tử CUỐI đang ở trạng thái chọn (bỏ :not(...) = chưa chọn; bỏ ::before/::after = vạch, dấu tick)
const selected = (sel: string) =>
  sel.replace(/:not\([^)]*\)/g, '').split(',').some((s) => {
    const last = s.trim().split(/[\s>+~]+/).pop() ?? '';
    return STATE.test(last) && !/::(before|after)/.test(last);
  });

describe('luật đang chọn A/B/C (TC-03)', () => {
  const sel = rules().filter((r) => selected(r.selector));

  it('không còn token --c-sel / --c-on-sel / --c-sel-count', () => {
    const left = rules().filter((r) => /var\(--c-(sel|on-sel|sel-count)\)/.test(r.body)).map((r) => `${r.file}: ${r.selector}`);
    expect(left).toEqual([]);
  });

  it('nền của trạng thái chọn chỉ là kiểu A, B hoặc C', () => {
    const bad = sel
      .map((r) => ({ r, bg: /(?:^|;)\s*background(?:-color)?:\s*([^;]+)/.exec(r.body)?.[1] }))
      .filter(({ bg }) => bg && !ALLOWED.some((a) => a.test(bg)))
      .map(({ r, bg }) => `${r.file}: ${r.selector} → ${bg}`);
    expect(bad).toEqual([]);
  });
});

describe('chọn một giá trị = kiểu C (VI/EN ở mọi chỗ)', () => {
  it('LanguageSwitch mang lớp seg--value và lớp đó tô xanh đặc khi chọn', () => {
    const tsx = readFileSync(resolve(root, 'ui/language-switch.tsx'), 'utf8');
    expect(tsx).toMatch(/className=\{`seg seg--value /);
    const rule = rules().find((r) => r.selector.includes(".seg--value button[aria-checked='true']"));
    expect(rule?.body).toMatch(/background:\s*var\(--c-acc\)/);
    expect(rule?.body).toMatch(/color:\s*var\(--c-on-acc\)/);
  });
});

describe('bộ chọn tháng (TN-10)', () => {
  it.each(['.month-switch', '.month-switch button', '.month-switch__pill'])('%s bo --r-sm, không viên tròn', (sel) => {
    const r = rules().find((x) => x.selector.endsWith(`] ${sel}`) && /border-radius/.test(x.body));
    expect(r?.body).toMatch(/border-radius:\s*var\(--r-sm\)/);
  });
});
