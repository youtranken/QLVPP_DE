import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../css/m1/states.css'), 'utf8');

describe('ô số trong app Hành chính không có mũi tên tăng/giảm', () => {
  it("[data-shell='admin'] input[type='number'] có appearance: textfield và ẩn spin-button", () => {
    expect(css).toMatch(/\[data-shell='admin'\] input\[type='number'\] \{[^}]*appearance: textfield/);
    expect(css).toMatch(/\[data-shell='admin'\] input\[type='number'\]::-webkit-inner-spin-button[^{]*\{[^}]*-webkit-appearance: none/);
  });
});
