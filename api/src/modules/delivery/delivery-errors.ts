import { BadRequestException, ConflictException } from '@nestjs/common';

export const lineNotReviewed = () =>
  new ConflictException({
    code: 'LINE_NOT_REVIEWED',
    message: 'Dòng chưa được duyệt.',
  });

export const lineRejected = () =>
  new ConflictException({
    code: 'LINE_REJECTED',
    message: 'Dòng đã bị từ chối — không giao.',
  });

// Kèm số đã giao hiện tại để giao diện làm mới thay vì báo lỗi chung
export const staleDelivery = (deliveredQty: number) =>
  new ConflictException({
    code: 'STALE_UPDATE',
    message: 'Dòng vừa được giao ở nơi khác — đã cập nhật số đã giao.',
    delivered_qty: deliveredQty,
  });

export const staleCancel = (line: { qty: number; delivered_qty: number }) =>
  new ConflictException({
    code: 'STALE_UPDATE',
    message: 'Dòng vừa đổi ở nơi khác — tải lại để xem phần còn lại.',
    qty: line.qty,
    delivered_qty: line.delivered_qty,
  });

export const deliverExceedsQty = (remaining: number) =>
  new BadRequestException({
    code: 'DELIVER_EXCEEDS_QTY',
    message: `Chỉ còn ${remaining} cần giao.`,
    remaining,
  });

// Dòng ngoài DM có trong bản in: chỉ giao trong số đã về của khóa
export const customNotReceived = (available: number) =>
  new ConflictException({
    code: 'CUSTOM_NOT_RECEIVED',
    message: `Hàng ngoài danh mục chưa về đủ — chỉ còn giao được ${available}.`,
    available,
  });

export const cancelNoteTooLong = (max: number) =>
  new BadRequestException({
    code: 'VALIDATION',
    message: `Ghi chú tối đa ${max} ký tự.`,
    fields: ['reason'],
  });

export const cancelReasonRequired = () =>
  new BadRequestException({
    code: 'REASON_REQUIRED',
    message: 'Chọn lý do hủy nợ; lý do "Khác" cần ghi chú ít nhất 3 ký tự.',
  });

export const notDebtYet = () =>
  new ConflictException({
    code: 'NOT_DEBT_YET',
    message:
      'Đây là phần chưa nhận của tháng đang giao — giảm ở Tổng hợp nếu không giao nữa.',
  });
