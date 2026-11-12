import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest chạy với cwd = web/
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const tokens = readFileSync(resolve(process.cwd(), 'src/css/tokens.css'), 'utf8');
const tokensM1 = readFileSync(resolve(process.cwd(), 'src/css/tokens-m1.css'), 'utf8');

describe('Nạp font Be Vietnam Pro (không nhảy dòng khi font về muộn)', () => {
  it('index.html nạp sẵn file woff2 (preload as=font, crossorigin) và stylesheet Google ngay trong <head>', () => {
    const preloads = [...html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="(https:\/\/fonts\.gstatic\.com\/[^"]+\.woff2)"/g)];
    expect(preloads.length).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Be\+Vietnam\+Pro/);
    // Không còn @import trong CSS bundle (phát hiện muộn, sau JS)
    expect(tokens).not.toMatch(/@import url\('https:\/\/fonts\.googleapis/);
  });

  it('font dự phòng chỉnh cỡ (size-adjust + ascent/descent) đứng ngay sau Be Vietnam Pro trong cả hai bộ token', () => {
    const faces = [...tokens.matchAll(/@font-face \{ font-family: 'Be Vietnam Pro Fallback';([^}]*)\}/g)].map((m) => m[1]);
    expect(faces).toHaveLength(2);
    for (const f of faces) expect(f).toMatch(/size-adjust: [\d.]+%;.*ascent-override: [\d.]+%;.*descent-override: [\d.]+%/);
    expect(tokens).toMatch(/--font-app: 'Be Vietnam Pro', 'Be Vietnam Pro Fallback',/);
    expect(tokensM1).toMatch(/--font: 'Be Vietnam Pro', 'Be Vietnam Pro Fallback',/);
  });
});
