import { BadRequestException, PipeTransform } from '@nestjs/common';

// Năm < 2000 không có kỳ thật; năm 0000 làm Postgres ném lỗi ngày → 500, Date.UTC đổi năm 0–99 thành 19xx
export const YM = /^([2-9]\d{3})-(0[1-9]|1[0-2])$/;

// Chỉ kiểm hình dạng; "không lớn hơn kỳ đang mở" cần ClockService nên nằm ở module kỳ
export function parseYm(raw: unknown): string {
  if (typeof raw !== 'string' || !YM.test(raw)) {
    throw new BadRequestException({
      code: 'INVALID_PERIOD',
      message: 'Kỳ phải có dạng YYYY-MM.',
    });
  }
  return raw;
}

export class YmPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    return parseYm(value);
  }
}
