import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
} from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DELIVER_QTY_MAX } from './delivery.dto';

export const BULK_MAX_REQUESTS = 100;
export const BULK_MAX_LINES = 200;

export class BulkLine {
  @IsUUID() line_id!: string;
  @IsInt() @Min(1) @Max(DELIVER_QTY_MAX) qty!: number;
  @IsInt() @Min(0) expected_delivered_qty!: number;
}

// Phiếu chỉ còn món chưa duyệt vẫn gửi được: lines rỗng khi đã có reject_line_ids
@ValidatorConstraint({ name: 'linesOrRejects' })
class LinesOrRejects implements ValidatorConstraintInterface {
  validate(lines: unknown, args: ValidationArguments): boolean {
    const rejects = (args.object as BulkRequest).reject_line_ids;
    return (
      (Array.isArray(lines) && lines.length > 0) ||
      (Array.isArray(rejects) && rejects.length > 0)
    );
  }
}

export class BulkRequest {
  @IsUUID() request_id!: string;
  @IsArray()
  @Validate(LinesOrRejects)
  @ArrayMaxSize(BULK_MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => BulkLine)
  lines!: BulkLine[];
  // Món ngoài danh mục chưa duyệt mà hộp giao đang hiện: giao kèm ghi Không mua trong cùng transaction
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BULK_MAX_LINES)
  @IsUUID('all', { each: true })
  reject_line_ids?: string[];
}

export class BulkDeliverBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_REQUESTS)
  @ValidateNested({ each: true })
  @Type(() => BulkRequest)
  requests!: BulkRequest[];
}

export type BulkRequestResult =
  | {
      request_id: string;
      ok: true;
      delivered_units: number;
      request_complete: boolean;
    }
  | {
      request_id: string;
      ok: false;
      code: string;
      line_id?: string;
      available?: number;
      remaining?: number;
    };

export interface BulkDeliverResult {
  results: BulkRequestResult[];
}
