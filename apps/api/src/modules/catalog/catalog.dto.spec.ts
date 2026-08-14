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

describe('ảnh minh hoạ của món', () => {
  const base = { categoryId: CATEGORY_ID, name: 'Bút bi', unit: 'cây' };

  it('nhận đường dẫn do server sinh', () => {
    const parsed = CreateItemSchema.parse({
      ...base,
      imagePath: '/api/uploads/9bba19f2-f18a-42cd-ab68-e9394cb18eb9.png',
    });
    expect(parsed.imagePath).toBe('/api/uploads/9bba19f2-f18a-42cd-ab68-e9394cb18eb9.png');
  });

  it('null = gỡ ảnh', () => {
    expect(CreateItemSchema.parse({ ...base, imagePath: null }).imagePath).toBeNull();
  });

  it('bỏ trống cũng hợp lệ (món không có ảnh)', () => {
    expect(CreateItemSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    ['URL ngoài', 'https://example.com/anh.png'],
    ['đường dẫn tuỳ ý', '/etc/passwd'],
    ['thoát thư mục', '/api/uploads/../../secret.png'],
    ['đuôi thực thi', '/api/uploads/9bba19f2-f18a-42cd-ab68-e9394cb18eb9.exe'],
    ['tên không phải uuid', '/api/uploads/anh.png'],
    ['javascript:', 'javascript:alert(1)'],
  ])('từ chối %s', (_label, value) => {
    // Chỉ nhận đúng khuôn server sinh: nếu không, admin có thể nhúng ảnh từ máy
    // chủ ngoài và biến trang danh mục thành nơi rò rỉ truy cập của người xem.
    expect(CreateItemSchema.safeParse({ ...base, imagePath: value }).success).toBe(false);
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
