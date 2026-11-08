import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DELIVER_QTY_MAX } from './delivery.dto';

export const BULK_MAX_REQUESTS = 100;
export const BULK_MAX_LINES = 200;

export class BulkLine {
  @IsUUID() line_id!: string;
  @IsInt() @Min(1) @Max(DELIVER_QTY_MAX) qty!: number;
  @IsInt() @Min(0) expected_delivered_qty!: number;
}

export class BulkRequest {
  @IsUUID() request_id!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_LINES)
  @ValidateNested({ each: true })
  @Type(() => BulkLine)
  lines!: BulkLine[];
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
