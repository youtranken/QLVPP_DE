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

// Phiếu tối đa 200 dòng (request.dto)
const REQUEST_LINES_MAX = 200;

export class ExpectedRemaining {
  @IsUUID() line_id!: string;
  @IsInt() @Min(1) remaining!: number;
}

export class CancelRequestBody {
  @IsArray()
  @ArrayMaxSize(REQUEST_LINES_MAX)
  @ArrayUnique((e: ExpectedRemaining) => e?.line_id)
  @ValidateNested({ each: true })
  @Type(() => ExpectedRemaining)
  expected_lines!: ExpectedRemaining[];
}

export interface CancelRequestResult {
  request_id: string;
  cancelled_now: number;
  lines: (CancelledLine & { cancelled_now: number })[];
  undo_id: string | null;
}
