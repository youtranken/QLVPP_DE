import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// R-D4.1, R-D4.7: luật gốc `.btn` chỉ đọc biến; mỗi biến thể chỉ khai biến, không viết lại :hover/:active
const SRC = resolve(__dirname, '..');
const BASE = join(SRC, 'css/m1/base.css');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.css')) out.push(p);
  }
  return out;
}

type Rule = { file: string; selectors: string[]; body: string };

function rulesOf(file: string): Rule[] {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    file,
    selectors: (m[1] ?? '').split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => !s.startsWith('@')),
    body: m[2] ?? '',
  }));
}

const all = walk(SRC).filter((f) => !f.endsWith('.test.css')).flatMap(rulesOf);
const admin = (sel: string) => sel.startsWith("[data-shell='admin']");
const declares = (r: Rule, prop: string) => new RegExp(`(^|[;\\s])${prop.replace(/[-]/g, '\\-')}\\s*:`).test(r.body);
const BUTTON_SEL = /\.(btn|hm-cta|hm-btn-dark)\b/;
const STATE = /:(hover|active)\b/;
const rulesFor = (selector: string) => all.filter((r) => r.selectors.includes(`[data-shell='admin'] ${selector}`));
const decl = (selector: string, prop: string) => rulesFor(selector).map((r) => r.body.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`))?.[1]?.trim()).filter(Boolean).at(-1);

// CSS M1 không chứa hex: giá trị nằm ở token trong tokens-m1.css
const tokens = readFileSync(join(SRC, 'css/tokens-m1.css'), 'utf8');
const tokenValue = (v?: string) => {
  const name = v?.match(/^var\((--[\w-]+)\)$/)?.[1];
  return name ? tokens.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]?.toUpperCase() : v;
};

describe('Nút admin: luật gốc chỉ đọc biến (R-D4.7)', () => {
  const base = rulesOf(BASE);
  const baseRule = (sel: string) => base.find((r) => r.selectors.includes(`[data-shell='admin'] ${sel}`));

  it('.btn đọc nền/chữ từ biến, hover và active đọc biến riêng', () => {
    expect(baseRule('.btn')?.body).toMatch(/background:\s*var\(--btn-bg,\s*var\(--c-surface\)\)/);
    expect(baseRule('.btn')?.body).toMatch(/color:\s*var\(--btn-fg,\s*var\(--c-ink\)\)/);
    expect(baseRule('.btn:hover:not(:disabled)')?.body).toMatch(/background:\s*var\(--btn-bg-hover,\s*var\(--c-surface-hover\)\)/);
    expect(baseRule('.btn:active:not(:disabled)')?.body).toMatch(/background:\s*var\(--btn-bg-active,\s*var\(--c-surface-2\)\)/);
  });

  it('ngoài base.css không còn luật .btn…/.hm-cta/.hm-btn-dark :hover/:active đặt background trực tiếp (admin)', () => {
    const bad = all
      .filter((r) => r.file !== BASE && declares(r, 'background'))
      .flatMap((r) => r.selectors.filter((s) => admin(s) && BUTTON_SEL.test(s) && STATE.test(s)).map((s) => `${r.file.replace(SRC, '')}: ${s}`));
    expect(bad).toEqual([]);
  });

  it('trong base.css chỉ .btn gốc được viết :hover/:active đặt background', () => {
    const bad = base
      .filter((r) => declares(r, 'background'))
      .flatMap((r) => r.selectors.filter((s) => admin(s) && /\.btn\S*:(hover|active)/.test(s) && !/^\[data-shell='admin'\] \.btn:(hover|active):not\(:disabled\)$/.test(s)));
    expect(bad).toEqual([]);
  });

  it('mọi luật khai --btn-bg thì cùng bộ chọn khai --btn-bg-hover và --btn-bg-active', () => {
    const withBg = all.filter((r) => declares(r, '--btn-bg'));
    expect(withBg.length).toBeGreaterThanOrEqual(7);
    const missing = withBg.flatMap((r) => ['--btn-bg-hover', '--btn-bg-active'].filter((p) => !declares(r, p)).map((p) => `${r.selectors.join(', ')} thiếu ${p}`));
    expect(missing).toEqual([]);
  });

  it('biến thể chữ sáng (--btn-fg on-dark/on-acc) có nền hover/active riêng, active tối hơn hover khai báo khác nhau', () => {
    const light = all.filter((r) => /--btn-fg:\s*var\(--c-on-(dark|acc)\)/.test(r.body));
    expect(light.length).toBeGreaterThanOrEqual(4);
    for (const r of light) {
      const hover = r.body.match(/--btn-bg-hover:\s*([^;]+)/)?.[1];
      const active = r.body.match(/--btn-bg-active:\s*([^;]+)/)?.[1];
      expect(hover, r.selectors.join()).toBeTruthy();
      expect(active, r.selectors.join()).toBeTruthy();
      expect(hover).not.toBe(active);
    }
  });

  it('.hm-cta giữ sắc xanh nhạt: nền #9FE3F0, hover #C4EEF6, active #8AD6E5, chữ tối (token)', () => {
    expect(decl('.hm-cta', '--btn-bg')).toBe('var(--c-bar-fill)');
    expect(tokenValue(decl('.hm-cta', '--btn-bg-hover'))).toBe('#C4EEF6');
    expect(tokenValue(decl('.hm-cta', '--btn-bg-active'))).toBe('#8AD6E5');
    expect(decl('.hm-cta', '--btn-fg')).toBe('var(--c-dark)');
  });

  it('nút nền khác trắng: hover/active không rơi về nền trắng của nút gốc', () => {
    const fallback = ['var(--c-surface-hover)', 'var(--c-surface-2)', 'var(--c-surface)'];
    const bad = all
      .filter((r) => declares(r, '--btn-bg') && !/--btn-bg:\s*(transparent|var\(--c-surface\))/.test(r.body))
      .flatMap((r) => ['--btn-bg-hover', '--btn-bg-active'].filter((p) => fallback.includes(r.body.match(new RegExp(`${p}:\\s*([^;]+)`))?.[1]?.trim() ?? '')).map((p) => `${r.selectors.join()} ${p}`));
    expect(bad).toEqual([]);
  });
});

describe('Ảnh chuẩn Playwright (R-D9.2)', () => {
  it('cấu hình có maxDiffPixelRatio 0.01; ma trận nút chụp fixture tự dựng, không mã món dev', () => {
    const cfg = readFileSync(resolve(SRC, '../playwright.config.ts'), 'utf8');
    expect(cfg).toMatch(/toHaveScreenshot:\s*\{\s*maxDiffPixelRatio:\s*0\.01/);
    const spec = readFileSync(resolve(SRC, '../playwright/button-matrix.spec.ts'), 'utf8');
    expect(spec).toMatch(/toHaveScreenshot\(/);
    expect(spec).not.toMatch(/\b[A-Z]\d{2}\b/);
  });
});
