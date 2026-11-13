import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');
// Thân của khối @media đầu tiên khớp điều kiện (đếm ngoặc, không dùng regex lồng)
function mediaBody(css: string, query: string): string {
  const start = css.indexOf(`@media ${query} {`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
  }
  return '';
}

describe('Khung trang khi đang tải/lỗi ở điện thoại (rà soát 13/11 #14)', () => {
  const phone = mediaBody(read('css/m1/shell.css'), '(max-width: 767px)');
  it('panel trắng kéo hết phần dưới thanh trên dù nội dung ngắn', () => {
    expect(phone).toMatch(/\.shell__main \{ display: flex; flex-direction: column; \}/);
    expect(phone).toMatch(/\.shell__panel \{ flex: 1 0 auto;/);
  });
  it('lúc in không còn flex/kéo dài', () => {
    const print = mediaBody(read('css/m1/shell.css'), 'print');
    expect(print).toMatch(/\.shell__main \{ display: block;/);
    expect(print).toMatch(/\.shell__panel \{ flex: none;/);
  });
});

describe('Tờ in bản chốt ở màn hẹp (rà soát 13/11 #4)', () => {
  const css = read('features/reports/print.m1.css');
  it('trên màn hình: tờ cuộn ngang trong khung riêng, không co dưới 600px', () => {
    const screen = mediaBody(css, 'screen');
    expect(screen).toMatch(/\.pp-sheet-scroll \{[^}]*overflow-x: auto/);
    expect(screen).toMatch(/\.pp-sheet-scroll > \.pp-sheet \{ min-width: 600px; \}/);
  });
  it('khung cuộn và bề rộng tối thiểu chỉ áp trên màn hình, không đổi bản in A4', () => {
    const outside = css.replace(mediaBody(css, 'screen'), '');
    expect(outside).not.toMatch(/pp-sheet-scroll/);
    expect(outside).not.toMatch(/min-width: 600px/);
  });
});
