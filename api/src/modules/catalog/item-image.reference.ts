import type { FileReference } from '../files/file-access.policy';

// Ảnh món trong danh mục là công khai cho mọi người đã đăng nhập (BR-14)
export const ITEM_IMAGE_REFERENCE: FileReference = {
  name: 'items.image_file_id',
  purpose: 'item_image',
  readCondition: 'EXISTS (SELECT 1 FROM items i WHERE i.image_file_id = f.id)',
  referencedCondition:
    'EXISTS (SELECT 1 FROM items i WHERE i.image_file_id = f.id)',
};
