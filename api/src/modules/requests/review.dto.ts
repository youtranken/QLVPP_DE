import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Name, OptionalText } from '../../common/dto-fields';
import { UnitCode } from '../units/units.dto';
import { NOTE_MAX, UpdatedAtStamp } from './request.dto';

export const REVIEW_STATUSES = [
  'pending',
  'accepted',
  'converted',
  'rejected',
] as const;
export type ReviewListStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_ACTIONS = ['accept', 'convert', 'reject'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export class ReviewListQuery {
  @IsOptional() @IsIn(REVIEW_STATUSES) status: ReviewListStatus = 'pending';
  // Hình dạng kiểm ở controller (parseYm) → INVALID_PERIOD
  @IsOptional() ym?: string;
}

const isNew = (o: ReviewItemInput) => !o.existing_id;

// Một trong hai: {existing_id} gắn món có sẵn, hoặc các trường tạo món mới
export class ReviewItemInput {
  @IsOptional() @IsUUID() existing_id?: string;
  @ValidateIf(isNew) @Name() name?: string;
  @OptionalText() name_en?: string | null;
  @UnitCode() unit?: string | null;
  @OptionalText() pack_note?: string | null;
  @ValidateIf(isNew) @IsUUID() category_id?: string;
  @IsOptional() @IsUUID() image_file_id?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(999) max_qty?: number;
  @IsOptional() @IsBoolean() admin_only?: boolean;
}

export class ReviewBody {
  @IsIn(REVIEW_ACTIONS) action!: ReviewAction;
  @OptionalText(NOTE_MAX) note?: string | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => ReviewItemInput)
  item?: ReviewItemInput;
  // Ngăn Điều chỉnh gửi mốc phiếu đang xem: phiếu đã đổi ở nơi khác → STALE_UPDATE, không duyệt
  @IsOptional() @UpdatedAtStamp() expected_updated_at?: string;
}
