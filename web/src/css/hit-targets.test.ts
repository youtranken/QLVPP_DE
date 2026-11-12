import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest chạy với cwd = web/ (css?raw trả rỗng trong môi trường này) → đọc thẳng file
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('vùng bấm', () => {
  it.each([
    ['features/stock/stock.m1.css', 'sk-item', 'sk-item__name'],
    ['features/directory/directory.m1.css', 'dr-person', 'dr-person__name'],
  ])('%s: nút tên phủ cả ô (ô làm mốc, ::after inset 0), không chỉ cao một dòng chữ', (file, cell, name) => {
    const css = read(file);
    expect(css).toMatch(new RegExp(`\\.table td:has\\(> \\.${cell}\\)\\s*\\{\\s*position:\\s*relative`));
    expect(css).toMatch(new RegExp(`\\.${name}::after\\s*\\{[^}]*position:\\s*absolute;[^}]*inset:\\s*0`));
    // Nút không tự làm mốc, không thì lớp phủ co về đúng dòng chữ
    expect(css).not.toMatch(new RegExp(`\\.${name}\\s*\\{[^}]*position:\\s*relative`));
  });
});
