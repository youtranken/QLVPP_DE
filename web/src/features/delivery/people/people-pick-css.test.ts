import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Điện thoại: ô chọn từng người là vùng chạm 44px (như ô Chọn tất cả), không phải ô 20px trần
const css = readFileSync(resolve(__dirname, 'delivery-people.m1.css'), 'utf8');

function phoneRules(): { selectors: string[]; body: string }[] {
  const out: { selectors: string[]; body: string }[] = [];
  for (const block of css.split('@media (max-width: 767px)').slice(1)) {
    const inner = block.slice(block.indexOf('{') + 1);
    for (const m of inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] });
  }
  return out;
}

describe('Giao hàng — ô chọn người ở 390px', () => {
  it('ô chọn trong thẻ người rộng và cao var(--hit), cùng luật với ô Chọn tất cả', () => {
    const rule = phoneRules().find((r) => r.selectors.includes("[data-shell='admin'] .pt-table td.pt-pick input[type='checkbox']"));
    expect(rule?.selectors).toContain("[data-shell='admin'] .pt-pickall input[type='checkbox']");
    expect(rule?.body).toMatch(/width: var\(--hit\)/);
    expect(rule?.body).toMatch(/height: var\(--hit\)/);
    expect(css).not.toMatch(/td\.pt-pick input \{ width: 20px/);
  });
});
