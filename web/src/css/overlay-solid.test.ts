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
});
