import { MAX_ITEM_QTY } from '@vpp/shared';
import { describe, expect, it } from 'vitest';
import { CreateItemSchema, UpdateCategorySchema, UpdateItemSchema } from './catalog.dto';

const CATEGORY_ID = '11111111-2222-3333-4444-555555555555';

describe('CreateItemSchema', () => {
  it('điền mặc định: maxQty = 20, active, không phải admin_only', () => {
    const parsed = CreateItemSchema.parse({ categoryId: CATEGORY_ID, name: 'Bút bi', unit: 'cây' });
    expect(parsed.maxQty).toBe(MAX_ITEM_QTY);
    expect(parsed.active).toBe(true);
    expect(parsed.adminOnly).toBe(false);
  });

  it('chặn maxQty vượt giới hạn mỗi món ≤ 20', () => {
    const result = CreateItemSchema.safeParse({
      categoryId: CATEGORY_ID,
      name: 'Bút bi',
      unit: 'cây',
      maxQty: MAX_ITEM_QTY + 1,
    });
    expect(result.success).toBe(false);
  });

  it('cắt khoảng trắng và từ chối tên rỗng', () => {
    expect(
      CreateItemSchema.parse({ categoryId: CATEGORY_ID, name: '  Bút bi  ', unit: ' cây ' }).name,
    ).toBe('Bút bi');
    expect(
      CreateItemSchema.safeParse({ categoryId: CATEGORY_ID, name: '   ', unit: 'cây' }).success,
    ).toBe(false);
  });

  it('categoryId phải là uuid', () => {
    expect(
      CreateItemSchema.safeParse({ categoryId: 'khong-phai-uuid', name: 'X', unit: 'cái' }).success,
    ).toBe(false);
  });
});

describe('schema cập nhật (PATCH)', () => {
  it('cho phép gửi một phần', () => {
    expect(UpdateItemSchema.parse({ active: false })).toEqual({ active: false });
    expect(UpdateCategorySchema.parse({ name: 'Nhóm mới' })).toEqual({ name: 'Nhóm mới' });
  });

  it('từ chối body rỗng — tránh PATCH không làm gì mà vẫn báo thành công', () => {
    expect(UpdateItemSchema.safeParse({}).success).toBe(false);
    expect(UpdateCategorySchema.safeParse({}).success).toBe(false);
  });
});
