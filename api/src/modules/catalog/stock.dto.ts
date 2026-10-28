import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../common/cursor';
import { TrimToNull } from './catalog.dto';

const QTY_MAX = 1_000_000;

export class StockChangeDto {
  @IsInt() @NotEquals(0) @Min(-QTY_MAX) @Max(QTY_MAX) delta!: number;
  @IsIn(['purchase', 'adjust']) reason!: 'purchase' | 'adjust';
  @TrimToNull() @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}

export class IssueDto {
  @IsInt() @Min(1) @Max(QTY_MAX) qty!: number;
  // Rỗng = "Dùng chung"
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipient_sub?: string | null;
  @TrimToNull() @IsOptional() @IsString() @MaxLength(500) reason?:
    string | null;
}

export class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit = DEFAULT_PAGE_LIMIT;

  @IsOptional() @IsString() @MaxLength(1000) cursor?: string;
}
