import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/css/m1/overlay.css'), 'utf8');

describe('panel phủ trên điện thoại', () => {
  it('≤ 640 px: panel .ovp nền đặc var(--c-surface), không kính mờ (alpha 1)', () => {
    const block = /@media \(max-width: 640px\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\.ovp\s*\{[^}]*background:\s*var\(--c-surface\)/);
    expect(block).toMatch(/\.ovp\s*\{[^}]*backdrop-filter:\s*none/);
  });

  it('641 px trở lên: luật gốc .ovp vẫn kính mờ (nền trong suốt + blur), nền đặc chỉ nằm trong khối ≤ 640', () => {
    const base = /\[data-shell='admin'\] \.ovp \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(base).toMatch(/background:\s*rgb\(255 255 255 \/ \.86\)/);
    expect(base).toMatch(/backdrop-filter:\s*blur/);
    expect(css.match(/\.ovp \{[^}]*background:\s*var\(--c-surface\)/g)).toHaveLength(1);
  });
});
