import { describe, expect, it } from 'vitest';
import { categoryIcon } from './category-icon';

describe('categoryIcon (G9) — biểu tượng tạm theo tên nhóm, không phân biệt hoa thường/dấu', () => {
  it.each([
    ['Bút & viết', 'pen'],
    ['Giấy & sổ', 'paper'],
    ['GIẤY', 'paper'],
    ['so tay', 'paper'],
    ['Kẹp, ghim', 'clip'],
    ['Băng dán', 'clip'],
    ['Lưu trữ hồ sơ', 'folder'],
    ['Bìa còng', 'folder'],
    ['Pin & điện', 'box'],
  ])('"%s" → %s', (name, icon) => {
    expect(categoryIcon(name)).toBe(icon);
  });

  it('không có nhóm → box', () => {
    expect(categoryIcon(null)).toBe('box');
    expect(categoryIcon('')).toBe('box');
  });
});
