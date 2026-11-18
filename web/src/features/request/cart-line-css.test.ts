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

const rule = (sel: string) => {
  const at = css.indexOf(`[data-shell='member'] ${sel} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

describe('TN-06: một bộ −/+ cho giỏ', () => {
  it('nút −/+ theo --hit (40 máy tính, 44 cảm ứng/điện thoại), không còn cỡ riêng 32×34 ở máy tính', () => {
    expect(rule('.rq-line-stepper')).toMatch(/grid-template-columns: var\(--hit\) 48px var\(--hit\)/);
    expect(rule('.rq-line-stepper')).toMatch(/height: var\(--hit\)/);
    expect(rule('.rq-line-stepper button')).toMatch(/height: var\(--hit\)/);
    expect(desktop).not.toMatch(/\.rq-line-stepper \{/);
    expect(desktop).not.toMatch(/\.rq-line-stepper button \{/);
  });
  it('nút tắt mờ .55 (sàn của luật nút vô hiệu), không đổi màu', () => {
    const off = rule('.rq-line-stepper button:disabled');
    expect(off).toMatch(/opacity: \.55/);
    expect(off).not.toMatch(/color:/);
  });
  it('ĐVT nằm cạnh bộ −/+ trên cùng một hàng', () => {
    expect(rule('.rq-line-qtyrow')).toMatch(/display: flex/);
  });
});
