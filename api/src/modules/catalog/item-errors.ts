import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { pgViolation } from '../../common/sql';
import { unknownUnit } from '../units/unit-errors';

// Lỗi nghiệp vụ của món: không tìm thấy, đang được dùng, thiếu ảnh/ĐVT, và vi phạm ràng buộc DB → lỗi có mã cho web
export const itemNotFound = () =>
  new NotFoundException({
    code: 'ITEM_NOT_FOUND',
    message: 'Không tìm thấy món.',
  });

const CONSTRAINT_ERRORS: Record<string, () => Error> = {
  items_category_id_fkey: () =>
    new BadRequestException({
      code: 'CATEGORY_NOT_FOUND',
      message: 'Nhóm món không tồn tại.',
    }),
  // ĐVT bị xóa giữa lúc kiểm active và lúc ghi món
  items_unit_fkey: () => unknownUnit('unit'),
  items_code_key: () =>
    new ConflictException({
      code: 'ITEM_CODE_EXISTS',
      message: 'Mã món đã được dùng.',
    }),
  stock_movements_item_id_fkey: () => itemInUse(),
  // Dòng phiếu chèn sau lúc kiểm isUsed nhưng trước DELETE
  request_lines_item_id_fkey: () => itemInUse(),
  // Ảnh bị job dọn tệp mồ côi xóa giữa lúc kiểm quyền và lúc ghi món
  items_image_file_id_fkey: () =>
    new BadRequestException({
      code: 'IMAGE_REQUIRED',
      message: 'Ảnh không còn — tải ảnh lại.',
    }),
};

export function itemConstraintError(error: unknown): unknown {
  const mapped = CONSTRAINT_ERRORS[pgViolation(error)?.constraint ?? ''];
  return mapped ? mapped() : error;
}

export function itemInUse() {
  return new ConflictException({
    code: 'ITEM_IN_USE',
    message: 'Món này đã được dùng — chỉ ngừng được, không xóa.',
  });
}

export function imageRequired() {
  return new BadRequestException({
    code: 'IMAGE_REQUIRED',
    message: 'Món phải có ảnh.',
  });
}

export function unitRequired() {
  return new BadRequestException({
    code: 'UNIT_REQUIRED',
    message: 'Chọn đơn vị tính.',
  });
}
