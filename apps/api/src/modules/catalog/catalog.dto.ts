import { MAX_ITEM_QTY } from '@vpp/shared';
import { z } from 'zod';

const name = z.string().trim().min(1, 'Tên không được để trống').max(120);
const unit = z.string().trim().min(1, 'Đơn vị tính không được để trống').max(30);

/**
 * Ảnh minh hoạ món: CHỈ nhận đường dẫn do `POST /api/uploads` sinh ra.
 * Không nhận URL tuỳ ý — nếu không, một admin có thể nhúng ảnh từ máy chủ ngoài
 * và biến trang danh mục thành nơi rò rỉ truy cập của người xem.
 * `null` = gỡ ảnh.
 */
const imagePath = z
  .string()
  .regex(
    /^\/api\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/,
    'Đường dẫn ảnh không hợp lệ — hãy tải ảnh lên bằng nút chọn ảnh',
  )
  .nullable();

export const CreateCategorySchema = z.object({
  name,
  /** Nhóm "Khác": cho phép người dùng tự nhập tên món + đính ảnh. */
  isOther: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
});

/** PATCH: mọi trường đều tuỳ chọn, nhưng phải gửi ít nhất một trường. */
export const UpdateCategorySchema = CreateCategorySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Không có trường nào để cập nhật' },
);

export const CreateItemSchema = z.object({
  categoryId: z.string().uuid(),
  name,
  unit,
  /** Món chỉ admin được đăng ký (vd giấy A4). */
  adminOnly: z.boolean().optional().default(false),
  maxQty: z.number().int().min(1).max(MAX_ITEM_QTY).optional().default(MAX_ITEM_QTY),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
  /** Ảnh minh hoạ do admin tải lên; bỏ trống hoặc null = không có ảnh. */
  imagePath: imagePath.optional(),
});

export const UpdateItemSchema = CreateItemSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Không có trường nào để cập nhật' },
);

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
export type CreateItemDto = z.infer<typeof CreateItemSchema>;
export type UpdateItemDto = z.infer<typeof UpdateItemSchema>;
