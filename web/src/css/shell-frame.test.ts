import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// TC-01: khung admin theo họ QLHS/QLTS
const shell = readFileSync(resolve(process.cwd(), 'src/css/m1/shell.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  // chỉ luật ngoài @media (áp mọi bề rộng)
  .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
const body = (sel: string) => [...shell.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === sel))?.[2] ?? '';

describe('khung admin (TC-01, TC-02)', () => {
  it('nền trang phẳng --c-page, không còn vỏ gradient tối', () => {
    expect(body("[data-shell='admin'] .shell")).toMatch(/background:\s*var\(--c-page\)/);
    expect(body("[data-shell='admin'] .shell")).not.toMatch(/gradient/);
    expect(body("[data-shell='admin'] .shell__panel")).not.toMatch(/background|border-radius/);
  });
  it('sidebar nền rail navy', () => {
    expect(body("[data-shell='admin'] .side")).toMatch(/background:\s*var\(--c-rail\)/);
  });
  it('đường dẫn đầu trang ẩn: thanh trên đã có "QLVPP › trang"', () => {
    expect(body("[data-shell='admin'] .page-head__crumbs")).toMatch(/display:\s*none/);
  });
});
