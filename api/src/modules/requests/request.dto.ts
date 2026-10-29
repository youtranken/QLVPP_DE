import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { STAMP_FROM_2000 } from '../../common/ym';
import { NAME_MAX, TrimToNull, UNITS } from '../catalog/catalog.dto';

export type Unit = (typeof UNITS)[number];
export const NOTE_MAX = 500;

const OptionalText = (max: number) => (target: object, key: string) => {
  TrimToNull()(target, key);
  IsOptional()(target, key);
  IsString()(target, key);
  MaxLength(max)(target, key);
};

const UpdatedAtStamp = () => (target: object, key: string) => {
  IsISO8601({ strict: true })(target, key);
  Matches(STAMP_FROM_2000, { message: `${key} phải có năm ≥ 2000` })(target, key);
};

export class LineInput {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsUUID() item_id?: string;
  @OptionalText(NAME_MAX) custom_name?: string | null;
  @TrimToNull() @IsOptional() @IsIn(UNITS) custom_unit?: Unit | null;
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

// Writer nhận chung cho member/Hành chính; reason chỉ Hành chính gửi được
export interface LinesPayload {
  lines: LineInput[];
  expected_updated_at?: string;
  reason?: string | null;
}

// Member phải nói rõ đang lưu kỳ nào: tab mở từ kỳ trước sau hạn sẽ bị PERIOD_LOCKED thay vì ghi nhầm kỳ mới
export class SaveMyLinesBody extends LinesBody {
  // Hình dạng kiểm ở controller (parseYm) để sai dạng trả INVALID_PERIOD như mọi tham số kỳ
  @IsDefined() ym!: string;
  @IsOptional() @UpdatedAtStamp() expected_updated_at?: string;
}

// Hành chính luôn sửa phiếu đã có → bắt buộc mốc updated_at đang xem
export class SaveLinesBody extends LinesBody {
  @UpdatedAtStamp() expected_updated_at!: string;
  @OptionalText(NOTE_MAX) reason?: string | null;
}

export class CreateOnBehalfBody extends LinesBody {
  @IsString() @IsNotEmpty() @MaxLength(255) user_sub!: string;
}
