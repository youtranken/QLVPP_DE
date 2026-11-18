import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest chạy với cwd = web/ (css?raw trả rỗng trong môi trường này)
const css = readFileSync(resolve(process.cwd(), 'src/css/tokens-m1.css'), 'utf8');

/** Lấy giá trị hex của token trong khối bảng màu (trước dấu `HẾT BẢNG MÀU`). */
function tok(name: string): string {
  const block = css.split('HẾT BẢNG MÀU')[0];
  const m = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})\\b`).exec(block);
  if (!m) throw new Error(`thiếu token ${name}`);
  return m[1];
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [fg: string, bg: string][] = [
  ['--c-ink', '--c-surface'], ['--c-muted', '--c-surface'], ['--c-acc', '--c-surface'],
  ['--c-ink', '--c-page'], ['--c-muted', '--c-page'],
  ['--c-ok', '--c-ok-soft'], ['--c-warn', '--c-warn-soft'], ['--c-danger', '--c-danger-soft'],
  ['--c-on-dark', '--c-acc'], ['--c-warn', '--c-cart'], ['--c-cart-ink', '--c-cart'], ['--c-cart-ink', '--c-surface'], ['--c-warn', '--c-surface'], ['--c-ok', '--c-surface'], ['--c-danger', '--c-danger-tint'], ['--c-on-dark', '--c-dark'],
  ['--c-on-dark', '--c-pick'], ['--c-acc', '--c-page'], ['--c-acc', '--c-acc-soft'],
  ['--c-muted', '--c-surface-2'], ['--c-acc-ink', '--c-acc-soft'], ['--c-on-dark', '--c-rail'], ['--c-count-ink', '--c-count'],
  ['--c-on-dark-2', '--c-rail'], ['--c-warn', '--c-warn-soft'],
];

// Thành phần phi văn bản (chấm kỳ ở cột 72) cần ≥ 3:1 trên nền của nó
const DOTS: [fg: string, bg: string][] = [['--c-bar-fill', '--c-rail'], ['--c-warn-fill', '--c-rail']];

describe('tương phản token bảng màu v3', () => {
  it('bảng màu mang tiêu đề v3 họ app PMH', () => {
    expect(css).toContain('BẢNG MÀU v3 "Họ app PMH"');
  });
  it('chữ trên rail (trắng 76%) trên navy ≥ 4.5', () => {
    // rgb(255 255 255 / .76) trên #0F1F3D trộn ra màu đặc rồi đo
    const over = (bg: number) => Math.round(255 * 0.76 + bg * 0.24);
    const [r, g, b] = [0x0f, 0x1f, 0x3d].map(over);
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    expect(css).toMatch(/--c-rail-ink:\s*rgb\(255 255 255 \/ \.76\)/);
    expect(contrast(hex, tok('--c-rail'))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(PAIRS)('%s trên %s ≥ 4.5', (fg, bg) => {
    expect(contrast(tok(fg), tok(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it('không còn token đang chọn nền tối --c-sel (TC-03)', () => {
    expect(css).not.toMatch(/--c-(sel|on-sel|sel-count):/);
  });
  it.each(DOTS)('chấm kỳ %s trên %s ≥ 3', (fg, bg) => {
    expect(contrast(tok(fg), tok(bg))).toBeGreaterThanOrEqual(3);
  });
  it('chấm kỳ trong shell.css dùng đúng hai token đó', () => {
    const shell = readFileSync(resolve(process.cwd(), 'src/css/m1/shell.css'), 'utf8');
    expect(shell).toMatch(/\.side__period-dot \{[^}]*background: var\(--c-bar-fill\)/);
    expect(shell).toMatch(/\.side__period\[data-last\] \.side__period-dot \{ background: var\(--c-warn-fill\)/);
  });
});
