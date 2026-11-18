import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CancelledLine } from '../requests/line-delivery.store';

// Một người: phiếu tháng đang giao + nợ cũ, mỗi phiếu tối đa 200 dòng
const USER_LINES_MAX = 1000;

export class ExpectedRemaining {
  @IsUUID() line_id!: string;
  @IsInt() @Min(1) remaining!: number;
}

export class CancelRequestBody {
  @IsArray()
  @ArrayMaxSize(USER_LINES_MAX)
  @ArrayUnique((e: ExpectedRemaining) => e?.line_id)
  @ValidateNested({ each: true })
  @Type(() => ExpectedRemaining)
  expected_lines!: ExpectedRemaining[];
}

export interface CancelRequestResult {
  user_sub: string;
  cancelled_now: number;
  lines: (CancelledLine & { cancelled_now: number })[];
  undo_id: string | null;
}
