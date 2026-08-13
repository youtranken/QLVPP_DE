import { describe, expect, it } from 'vitest';
import { SEED_CATALOG, SEED_DEPARTMENTS, SEED_ITEM_COUNT } from './seed-data';

describe('dữ liệu mẫu danh mục', () => {
  it('đủ 5 phòng ban và 5 nhóm, ~25 món theo SDD §11', () => {
    expect(SEED_DEPARTMENTS).toHaveLength(5);
    expect(SEED_CATALOG).toHaveLength(5);
    expect(SEED_ITEM_COUNT).toBe(25);
  });

  it('chỉ giấy A4 là món admin_only', () => {
    const adminOnly = SEED_CATALOG.flatMap((group) => group.items).filter((item) => item.adminOnly);
    expect(adminOnly.map((item) => item.name)).toEqual(['Giấy A4 (ram 500 tờ)']);
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
});
