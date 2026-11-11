import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Phiếu 1280×800: dòng ngoài danh mục có nhãn "Adm D&E xem từ …" dài; nhãn gãy hai dòng làm 3 dòng phiếu phải cuộn
const css = readFileSync(resolve(__dirname, 'request.m1.css'), 'utf8');
const desktop = css.slice(css.indexOf('@media (min-width: 901px)'));

describe('Phiếu — dòng có nhãn ở máy tính', () => {
  it('khối tên + nhãn dùng cả bề ngang dưới nút ×, tên chừa chỗ cho nút', () => {
    expect(desktop).toContain("[data-shell='member'] .rq-line:has(.tag) .rq-line-main { grid-column: 2 / 4; }");
    expect(desktop).toMatch(/\.rq-line:has\(\.tag\) \.rq-line-name \{ padding-right: calc\(32px \+ var\(--s-2\)\); \}/);
    expect(desktop).toMatch(/\.rq-line:has\(\.tag\) \.rq-line-x \{[^}]*align-self: start;/);
  });
});
