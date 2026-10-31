import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { pgViolation } from '../../common/sql';

// Dòng mới chưa có id → chỉ trỏ được bằng vị trí trong body
export type LineRef = { line_index: number } | { line_id: string };

export function lineError(
  code: string,
  message: string,
  ref: LineRef,
  extra: Record<string, unknown> = {},
  status: HttpStatus = HttpStatus.BAD_REQUEST,
): HttpException {
  return new HttpException({ code, message, ...ref, ...extra }, status);
}

export const requestNotFound = (message = 'Chưa có phiếu kỳ này.') =>
  new NotFoundException({ code: 'REQUEST_NOT_FOUND', message });

export const invalidPeriod = () =>
  new BadRequestException({
    code: 'INVALID_PERIOD',
    message: 'Kỳ chưa mở đăng ký.',
  });

export const staleUpdate = () =>
  new ConflictException({
    code: 'STALE_UPDATE',
    message: 'Phiếu vừa được sửa ở nơi khác — tải lại rồi lưu.',
  });

export const linesEmpty = () =>
  new BadRequestException({
    code: 'LINES_EMPTY',
    message: 'Phiếu cần ít nhất một món.',
  });

export const periodLocked = (nextYm: string) =>
  new ConflictException({
    code: 'PERIOD_LOCKED',
    message: 'Kỳ này đã khóa sổ.',
    next_ym: nextYm,
  });

export const reasonRequired = () =>
  new BadRequestException({
    code: 'REASON_REQUIRED',
    message: 'Kỳ đã khóa — cần ghi lý do điều chỉnh.',
  });

export const userNotFound = () =>
  new NotFoundException({
    code: 'USER_NOT_FOUND',
    message: 'Không tìm thấy người dùng.',
  });

export const duplicateItem = (ref: LineRef | Record<string, never> = {}) =>
  new BadRequestException({
    code: 'DUPLICATE_ITEM',
    message: 'Món này đã có trong phiếu.',
    ...ref,
  });

// Kèm id để Hành chính mở thẳng ngăn Điều chỉnh phiếu đó
export const requestExists = (requestId: string) =>
  new ConflictException({
    code: 'REQUEST_EXISTS',
    message: 'Người này đã có phiếu kỳ đang mở — sửa phiếu đó.',
    request_id: requestId,
  });

export const userInactive = () =>
  new BadRequestException({
    code: 'USER_INACTIVE',
    message: 'Người này không còn hoạt động.',
  });

export const userIsAdmin = () =>
  new BadRequestException({
    code: 'USER_IS_ADMIN',
    message: 'Người này là Hành chính — Hành chính không đăng ký VPP.',
  });

export const lineNotFound = () =>
  new NotFoundException({
    code: 'LINE_NOT_FOUND',
    message: 'Không tìm thấy dòng.',
  });

export const lineAlreadyReviewed = () =>
  new ConflictException({
    code: 'LINE_ALREADY_REVIEWED',
    message: 'Dòng này đã được xử lý — tải lại để xem kết quả.',
  });

export const rejectReasonRequired = () =>
  new BadRequestException({
    code: 'REASON_REQUIRED',
    message: 'Nhập lý do từ chối (ít nhất 3 ký tự).',
  });

const readonlyLine = () =>
  new BadRequestException({
    code: 'LINE_READONLY',
    message: 'Dòng đã có đợt giao — không xóa được.',
  });

// Vi phạm do tx song song lọt qua bước kiểm (ảnh bị dọn, món bị xóa, trùng món); RESTRICT trả 23001 chứ không phải 23503
const CONSTRAINT_ERRORS: Record<string, () => HttpException> = {
  '23505:request_lines_item_uq': () => duplicateItem(),
  '23503:request_lines_image_file_id_fkey': () =>
    new BadRequestException({
      code: 'IMAGE_REQUIRED',
      message: 'Ảnh không còn — tải ảnh lại.',
    }),
  '23503:request_lines_item_id_fkey': () =>
    new BadRequestException({
      code: 'ITEM_NOT_FOUND',
      message: 'Không tìm thấy món.',
    }),
  // ĐVT chưa dùng bị xóa giữa lúc lập kế hoạch dòng và lúc ghi
  '23503:request_lines_custom_unit_fkey': () =>
    new BadRequestException({
      code: 'VALIDATION',
      message: 'Đơn vị tính không có.',
      fields: ['custom_unit'],
    }),
  '23001:stock_movements_ref_line_id_fkey': readonlyLine,
  '23001:line_deliveries_line_id_fkey': readonlyLine,
};

export function constraintError(error: unknown): HttpException | null {
  const violation = pgViolation(error);
  const mapped =
    violation && CONSTRAINT_ERRORS[`${violation.code}:${violation.constraint}`];
  return mapped ? mapped() : null;
}
