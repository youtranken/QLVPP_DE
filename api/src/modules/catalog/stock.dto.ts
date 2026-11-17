import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { TrimToNull } from '../../common/dto-fields';
import { YM } from '../../common/ym';

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

export class ReceiptLine {
  @IsUUID() item_id!: string;
  @IsInt() @Min(1) @Max(99_999) qty!: number;
  @IsInt() @Min(0) expected_stock_qty!: number;
}

export class ReceiptBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLine)
  lines!: ReceiptLine[];
  @IsString() @Matches(YM) ym!: string;
  @TrimToNull() @IsOptional() @IsString() @MaxLength(500) note?: string | null;
  // Bản in client đã đọc (null = chưa có bản); bỏ trống = không kiểm (về bù)
  @IsOptional() @IsUUID() snapshot_id?: string | null;
}

export class CustomReceiptBody {
  @IsString() @MaxLength(500) line_key!: string;
  @IsInt() @Min(1) @Max(99_999) qty!: number;
  // Số đã về client đang thấy: gửi lại/hai người cùng bấm → STALE_UPDATE thay vì cộng hai lần
  @IsInt() @Min(0) expected_received!: number;
  @TrimToNull() @IsOptional() @IsString() @MaxLength(500) note?: string | null;
  @IsOptional() @IsUUID() snapshot_id?: string | null;
}
