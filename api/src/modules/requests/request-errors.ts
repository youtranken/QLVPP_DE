import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

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

export const requestExists = () =>
  new ConflictException({
    code: 'REQUEST_EXISTS',
    message: 'Người này đã có phiếu kỳ đang mở — sửa phiếu đó.',
  });

export const userInactive = () =>
  new BadRequestException({
    code: 'USER_INACTIVE',
    message: 'Người này không còn hoạt động.',
  });
