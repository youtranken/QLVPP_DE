import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Ô chọn trong bảng (cả ô chọn người ở Giao hàng) là vùng chạm 44px ở MỌI bề rộng, vẽ chung một luật ở css/m1/table.css;
// màn này không được tự đặt lại cỡ ô (20px/18px trần) đè lên luật chung
const table = readFileSync(resolve(__dirname, '../../../css/m1/table.css'), 'utf8');
const own = readFileSync(resolve(__dirname, 'delivery-people.m1.css'), 'utf8');

describe('Giao hàng — ô chọn người', () => {
  it('luật chung: ô chọn trong bảng rộng và cao var(--hit), ô vuông vẽ bằng ::before', () => {
    const rule = table.match(/\[data-shell='admin'\] table input\[type='checkbox'\] \{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/width: var\(--hit\)/);
    expect(rule?.[1]).toMatch(/height: var\(--hit\)/);
    expect(table).toMatch(/\] table input\[type='checkbox'\]::before \{ content: ''/);
  });
  it('Giao hàng không tự đặt cỡ ô chọn trong bảng; cột chọn rộng đúng vùng chạm', () => {
    expect(own).not.toMatch(/td\.pt-pick input[^{]*\{[^}]*width: (18|20)px/);
    expect(own).toMatch(/\.pt-table th\.pt-pick \{ width: var\(--hit\)/);
  });
});
