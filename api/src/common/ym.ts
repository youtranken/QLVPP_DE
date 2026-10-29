import { BadRequestException, PipeTransform } from '@nestjs/common';

// Mọi input ngày năm ≥ 2000: không có kỳ thật trước đó, năm 0000 làm Postgres ném lỗi → 500, Date.UTC đổi năm 0–99 thành 19xx
export const MIN_YEAR = 2000;
export const YM = /^([2-9]\d{3})-(0[1-9]|1[0-2])$/;
export const DATE_FROM_2000 = /^[2-9]\d{3}-\d{2}-\d{2}$/;
export const STAMP_FROM_2000 = /^[2-9]\d{3}-/;

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
