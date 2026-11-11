import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

// Thân các khối @media (max-width: 767px) — đếm ngoặc để lấy đúng khối lồng
function phoneBlocks(css: string): string[] {
  const out: string[] = [];
  const re = /@media \(max-width: 767px\) \{/g;
  while (re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out;
}

// Mọi khai báo padding / padding-bottom của khung trang admin trong khối ≤ 767px
function shellMainPadding(css: string): string[] {
  return phoneBlocks(css).flatMap((block) =>
    [...block.matchAll(/\[data-shell='admin'\] \.shell__main \{([^}]*)\}/g)].flatMap((r) =>
      [...r[1].matchAll(/padding(?:-bottom)?\s*:\s*([^;]+)/g)].map((d) => d[0]),
    ),
  );
}

describe('khung trang 390 chừa chỗ cho thanh hàng loạt cố định', () => {
  const files = ['css/m1/base.css', 'css/m1/shell.css'];

  it('chỉ một khai báo padding cho .shell__main ở ≤ 767px và nó có --bulkbar-h (không bị shorthand đè)', () => {
    const decls = files.flatMap((f) => shellMainPadding(read(f)));
    expect(decls).toHaveLength(1);
    expect(decls[0]).toContain('var(--bulkbar-h, 0px)');
  });

  it('cuộn tới ô đang focus cũng chừa chỗ theo biến của khung, không đặt biến trên <html>', () => {
    expect(read('css/base.css')).not.toMatch(/html \{ scroll-padding-bottom: var\(--bulkbar-h/);
    const m1 = read('css/m1/base.css');
    expect(phoneBlocks(m1).join('\n')).toMatch(/\[data-shell='admin'\] \.shell__main \* \{ scroll-margin-bottom: var\(--bulkbar-h, 0px\); \}/);
  });
});
