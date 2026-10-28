import { BadRequestException, PipeTransform } from '@nestjs/common';

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

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
