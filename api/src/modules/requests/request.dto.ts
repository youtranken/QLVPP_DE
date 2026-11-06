import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { STAMP_FROM_2000 } from '../../common/ym';
import { NAME_MAX, OptionalText } from '../../common/dto-fields';
import { UnitCode } from '../units/units.dto';

export const NOTE_MAX = 500;

const UpdatedAtStamp = () => (target: object, key: string) => {
  IsISO8601({ strict: true })(target, key);
  Matches(STAMP_FROM_2000, { message: `${key} phải có năm ≥ 2000` })(
    target,
    key,
  );
};

export class LineInput {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsUUID() item_id?: string;
  @OptionalText(NAME_MAX) custom_name?: string | null;
  @UnitCode() custom_unit?: string | null;
  @OptionalText(NOTE_MAX) custom_note?: string | null;
  @IsOptional() @IsUUID() image_file_id?: string | null;
  // Không kiểm kiểu ở DTO: writer trả QTY_INVALID kèm line_index thay vì VALIDATION chung
  @IsDefined() qty!: number;
}

class LinesBody {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineInput)
  lines!: LineInput[];
}

export interface LinesPayload {
  lines: LineInput[];
  expected_updated_at?: string;
}

// Member phải nói rõ đang lưu kỳ nào: tab mở từ kỳ trước sau hạn sẽ bị PERIOD_LOCKED thay vì ghi nhầm kỳ mới
export class SaveMyLinesBody extends LinesBody {
  // Hình dạng kiểm ở controller (parseYm) để sai dạng trả INVALID_PERIOD như mọi tham số kỳ
  @IsDefined() ym!: string;
  @IsOptional() @UpdatedAtStamp() expected_updated_at?: string;
}

// Mã/ghi chú lý do kiểm ở parseAdjustLines (VALIDATION fields 'lines.*', đếm mã điểm sau NFC); dòng không id để writer trả LINE_ADD_FORBIDDEN
export class AdjustLineDto {
  @IsOptional() @IsUUID() id?: string;
  @IsInt() @Min(0) qty!: number;
  @ValidateIf((line: AdjustLineDto) => line.id !== undefined)
  @IsInt()
  @Min(1)
  expected_qty?: number;
  @IsOptional() reason_code?: unknown;
  @IsOptional() reason_note?: unknown;
}

// Hành chính luôn sửa phiếu đã có → bắt buộc mốc updated_at đang xem
export class SaveLinesBody {
  @UpdatedAtStamp() expected_updated_at!: string;
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AdjustLineDto)
  lines!: AdjustLineDto[];
}
