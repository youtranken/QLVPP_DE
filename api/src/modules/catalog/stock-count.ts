import { BadRequestException, ConflictException } from '@nestjs/common';

const REASON_MIN = 3;

export function countDelta(c: {
  counted: number;
  expected: number;
  stock: number;
}): number {
  if (c.stock !== c.expected) {
    throw new ConflictException({
      code: 'STALE_UPDATE',
      message: 'Tồn kho vừa đổi ở nơi khác — kiểm lại số đếm.',
      stock_qty: c.stock,
    });
  }
  if (c.counted === c.stock) {
    throw new BadRequestException({
      code: 'VALIDATION',
      message: 'Số đếm bằng tồn hiện tại — không có gì để ghi.',
      fields: ['counted_qty'],
    });
  }
  return c.counted - c.stock;
}

export function countNote(note: string | null | undefined): string {
  const trimmed = note?.trim() ?? '';
  if (trimmed.length < REASON_MIN) throw reasonRequired();
  return trimmed;
}

export function reasonRequired() {
  return new BadRequestException({
    code: 'REASON_REQUIRED',
    message: 'Cần ghi lý do.',
  });
}
