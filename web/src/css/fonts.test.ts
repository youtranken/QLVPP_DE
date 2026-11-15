import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Be Vietnam Pro tự host từ @fontsource 5.3.0 như QLHS/QLTS/Tài khoản D&E (chủ dự án 15/11), không CDN
const web = process.cwd();
const fonts = readFileSync(resolve(web, 'src/css/fonts.css'), 'utf8');
const faces = [...fonts.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');

describe('font Be Vietnam Pro tự host', () => {
  it('gói @fontsource/be-vietnam-pro ghim đúng 5.3.0', () => {
    const pkg = JSON.parse(readFileSync(resolve(web, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@fontsource/be-vietnam-pro']).toBe('5.3.0');
  });

  it('mỗi độ đậm app dùng (400/500/600/700/800) có cả bảng latin lẫn tiếng Việt, font-display swap', () => {
    for (const f of faces) {
      expect(f).toMatch(/font-family: 'Be Vietnam Pro'/);
      expect(f).toMatch(/font-display: swap/);
    }
    for (const w of ['400', '500', '600', '700', '800']) {
      const own = faces.filter((f) => f.includes(`font-weight: ${w};`));
      expect(own.some((f) => /unicode-range:[^;]*U\+0000-00FF/.test(f))).toBe(true);
      expect(own.some((f) => /unicode-range:[^;]*U\+1EA0-1EF9/.test(f))).toBe(true);
    }
  });

  it('mọi file font lấy từ gói đã cài, không http/CDN', () => {
    const urls = faces.flatMap((f) => [...f.matchAll(/url\(([^)]+)\)/g)].map((m) => (m[1] ?? '').replace(/['"]/g, '')));
    expect(urls).toHaveLength(faces.length);
    for (const u of urls) {
      expect(u).toMatch(/^@fontsource\/be-vietnam-pro\/files\//);
      expect(existsSync(resolve(web, 'node_modules', u))).toBe(true);
    }
  });

  it('main.tsx nạp fonts.css trước tokens.css', () => {
    const main = readFileSync(resolve(web, 'src/main.tsx'), 'utf8');
    const a = main.indexOf("import '@/css/fonts.css'");
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(main.indexOf("import '@/css/tokens.css'"));
  });
});
