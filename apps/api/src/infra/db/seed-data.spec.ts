import { describe, expect, it } from 'vitest';
import { SEED_CATALOG, SEED_DEPARTMENTS, SEED_ITEM_COUNT } from './seed-data';

describe('dữ liệu danh mục', () => {
  it('đủ 5 phòng ban và 7 nhóm, 50 món theo form đăng ký của công ty', () => {
    expect(SEED_DEPARTMENTS).toHaveLength(5);
    expect(SEED_CATALOG).toHaveLength(7);
    expect(SEED_ITEM_COUNT).toBe(50);
  });

  it('chỉ giấy A4 là món admin_only', () => {
    const adminOnly = SEED_CATALOG.flatMap((group) => group.items).filter((item) => item.adminOnly);
    expect(adminOnly.map((item) => item.name)).toEqual(['Giấy photo A4 trắng 70 Exell']);
  });

  it('đúng một nhóm "Khác" và nhóm đó không có món cố định', () => {
    const other = SEED_CATALOG.filter((group) => group.isOther);
    expect(other).toHaveLength(1);
    expect(other[0].items).toHaveLength(0);
  });

  it('không trùng tên món trong cùng nhóm (khớp unique index items(category_id, name))', () => {
    for (const group of SEED_CATALOG) {
      const names = group.items.map((item) => item.name);
      expect(new Set(names).size, `nhóm ${group.name} có tên món trùng`).toBe(names.length);
    }
  });

  it('mọi món cố định đều có ảnh minh hoạ, và không hai món nào dùng chung file ảnh', () => {
    const items = SEED_CATALOG.flatMap((group) => group.items);
    expect(items.filter((item) => !item.image)).toEqual([]);
    const images = items.map((item) => item.image);
    expect(new Set(images).size).toBe(images.length);
  });
});
