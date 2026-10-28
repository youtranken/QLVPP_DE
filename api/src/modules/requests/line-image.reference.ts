import type { FileReference } from '../files/file-access.policy';

// Ảnh dòng chỉ chủ phiếu (và Hành chính) xem được, kể cả ảnh Hành chính tải cho dòng của họ
export const LINE_IMAGE_REFERENCE: FileReference = {
  name: 'request_lines.image_file_id',
  purpose: 'line_image',
  readCondition:
    'EXISTS (SELECT 1 FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE l.image_file_id = f.id AND r.user_sub = $2)',
  referencedCondition:
    'EXISTS (SELECT 1 FROM request_lines l WHERE l.image_file_id = f.id)',
};
