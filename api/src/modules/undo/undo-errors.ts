import { ConflictException, NotFoundException } from '@nestjs/common';
import type { UndoCode } from './undo-window';

const MESSAGES: Record<UndoCode, string> = {
  UNDO_NOT_FOUND: 'Không tìm thấy thao tác để hoàn tác.',
  UNDO_ALREADY_DONE: 'Thao tác này đã được hoàn tác.',
  UNDO_EXPIRED: 'Đã quá 5 giây, không hoàn tác được nữa.',
};

export function undoError(code: UndoCode): Error {
  const body = { code, message: MESSAGES[code] };
  return code === 'UNDO_NOT_FOUND'
    ? new NotFoundException(body)
    : new ConflictException(body);
}
