import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Ngưỡng nút: chữ ≥ 4.5 ở mặc định/hover/active, disabled ≥ 3, hover≠mặc định và active≠hover ≥ 1.15; tính từ token để không chờ ma trận Playwright
const SRC = resolve(__dirname, '..');
const tokens = readFileSync(join(SRC, 'css/tokens-m1.css'), 'utf8');
const base = readFileSync(join(SRC, 'css/m1/base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const hex = (name: string): string => {
  const v = tokens.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
  if (!v) throw new Error(`thiếu token ${name}`);
  return v;
};
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const rule = (sel: string) => base.match(new RegExp(`\\[data-shell='admin'\\] ${sel.replace(/[.()[\]:]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const varOf = (body: string, prop: string) => body.match(new RegExp(`${prop}:\\s*var\\((--[\\w-]+)\\)`))?.[1];

describe('Nút đỏ nhạt (danger-soft): tương phản từ token', () => {
  const body = rule('.btn--danger-ghost');
  const bg = hex(varOf(body, '--btn-bg')!);
  const hover = hex(varOf(body, '--btn-bg-hover')!);
  const active = hex(varOf(body, '--btn-bg-active')!);
  const fg = hex(varOf(body, '--btn-fg')!);
  const fgActive = hex(varOf(body, '--btn-fg-active') ?? varOf(body, '--btn-fg')!);

  it('chữ ≥ 4.5:1 ở mặc định, hover và lúc nhấn', () => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(fg, hover)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(fgActive, active)).toBeGreaterThanOrEqual(4.5);
  });

  it('hover khác mặc định và nhấn khác hover ≥ 1.15:1', () => {
    expect(ratio(bg, hover)).toBeGreaterThanOrEqual(1.15);
    expect(ratio(hover, active)).toBeGreaterThanOrEqual(1.15);
  });
});

describe('Nút vô hiệu: màu riêng, không mờ bằng opacity', () => {
  it('.btn:disabled đọc --btn-bg-disabled/--btn-fg-disabled, mặc định chữ/nền ≥ 3:1', () => {
    const body = rule('.btn:disabled');
    expect(body).not.toMatch(/opacity/);
    const bg = body.match(/background:\s*var\(--btn-bg-disabled,\s*var\((--[\w-]+)\)\)/)?.[1];
    const fg = body.match(/color:\s*var\(--btn-fg-disabled,\s*var\((--[\w-]+)\)\)/)?.[1];
    expect(bg && fg).toBeTruthy();
    expect(ratio(hex(fg!), hex(bg!))).toBeGreaterThanOrEqual(3);
  });

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (p.endsWith('.css')) out.push(p);
    }
    return out;
  }

  it('không luật nút nào đặt opacity < .55 khi vô hiệu', () => {
    const bad: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sels = (m[1] ?? '').split(',').map((s) => s.trim()).filter((s) => /:disabled|\[aria-disabled/.test(s) && !/\b(select|input)\b/.test(s));
        const op = m[2]?.match(/(^|[;\s])opacity:\s*([\d.]+)/)?.[2];
        if (sels.length && op !== undefined && Number(op) < 0.55) bad.push(`${file.replace(SRC, '')}: ${sels.join(', ')} opacity ${op}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
