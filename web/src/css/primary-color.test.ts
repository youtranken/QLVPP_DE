import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');
const ruleBody = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

describe('một màu nút chính (giao diện A)', () => {
  it.each([
    ['css/m1/member-page.css', "[data-shell='member'] .m-panel .btn--primary"],
    ['features/request/request.m1.css', "[data-shell='member'] .rq-cart-save"],
    ['features/request/request.m1.css', "[data-shell='member'] .rq-dialog .sheet-footer .btn--primary"],
  ])('%s %s: nền var(--c-acc), không --c-dark', (file, selector) => {
    const body = ruleBody(read(file), selector);
    expect(body).toMatch(/background:\s*var\(--c-acc\)/);
    expect(body).not.toMatch(/var\(--c-dark\)/);
  });
});
