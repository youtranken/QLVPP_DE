import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';

export const unitExists = () =>
  new ConflictException({
    code: 'UNIT_EXISTS',
    message: 'Đã có đơn vị tính tên này.',
  });

export const unitNotFound = () =>
  new NotFoundException({
    code: 'UNIT_NOT_FOUND',
    message: 'Không tìm thấy đơn vị tính.',
  });

export const unitInUse = () =>
  new ConflictException({
    code: 'UNIT_IN_USE',
    message: 'Đơn vị đang được dùng — chỉ ngừng được.',
  });

export const UNIT_INACTIVE_MESSAGE = 'Đơn vị tính đã ngừng — chọn đơn vị khác.';

export const unitInactive = () =>
  new BadRequestException({
    code: 'UNIT_INACTIVE',
    message: UNIT_INACTIVE_MESSAGE,
  });

export const unknownUnit = (field: string) =>
  new BadRequestException({
    code: 'VALIDATION',
    message: 'Đơn vị tính không có.',
    fields: [field],
  });

export function unitChoiceError(
  unit: { active: boolean } | undefined,
  field: string,
): HttpException | null {
  if (!unit) return unknownUnit(field);
  return unit.active ? null : unitInactive();
}
