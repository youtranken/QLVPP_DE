import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Rà soát 13/11 Gu #3 (nhân viên): EN ở 1280 — "Received 5/5" (cần 123px) và "Received 09:35 12/11" (cần 171px) xuống
// hai dòng trong cột Tình trạng 120px / Ghi chú 144px, bản VI vừa một dòng. Đo thật ở after/G-5-*.
const css = readFileSync(resolve(process.cwd(), 'src/features/request/history.m1.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rem = (sel: string, block: string) => Number(new RegExp(`${sel.replace(/[.[\]()':]/g, '\\$&')}\\s*\\{\\s*width:\\s*([\\d.]+)rem`).exec(block)?.[1]);

describe('bảng chi tiết lịch sử: cột EN vừa một dòng ở ≥1280', () => {
  const en = css.slice(css.indexOf('@media (min-width: 1280px)'));
  const start = css.indexOf('@media (min-width: 768px) {');
  const base = css.slice(start, css.indexOf('}\n', css.indexOf('.hs-c-last', start)) + 2);

  it('chỉ áp khi :lang(en), trong @media (min-width: 1280px); Còn chờ ≥ 124px, Nhận lần cuối ≥ 172px', () => {
    expect(css).toContain('@media (min-width: 1280px)');
    expect(rem("[data-shell='member']:lang(en) .hs-c-wait", en) * 16).toBeGreaterThanOrEqual(124);
    expect(rem("[data-shell='member']:lang(en) .hs-c-last", en) * 16).toBeGreaterThanOrEqual(172);
    // cột số EN vẫn đủ tiêu đề (Ordered 60px, To deliver 70px + padding 24px)
    expect(rem("[data-shell='member']:lang(en) .hs-c-reg", en) * 16).toBeGreaterThanOrEqual(84);
    expect(rem("[data-shell='member']:lang(en) .hs-c-give", en) * 16).toBeGreaterThanOrEqual(94);
  });

  it('bề rộng chung (VI) giữ nguyên: Còn chờ 7.5rem, Nhận lần cuối 9rem', () => {
    expect(rem("[data-shell='member'] .hs-c-wait", base)).toBe(7.5);
    expect(rem("[data-shell='member'] .hs-c-last", base)).toBe(9);
    expect(base).not.toContain(':lang(');
  });
});
