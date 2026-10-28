import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const UNITS = [
  'cai',
  'hop',
  'cay',
  'ram',
  'cuon',
  'loc',
  'bich',
  'chai',
  'bo',
] as const;
export const NAME_MAX = 120;

export const uuidParam = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      code: 'VALIDATION',
      message: 'id phải là uuid.',
    }),
});

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
export const Trim = () => Transform(({ value }) => trim(value));
// Chuỗi rỗng sau trim của trường tùy chọn = xóa giá trị
export const TrimToNull = () =>
  Transform(({ value }) => (trim(value) === '' ? null : trim(value)));
// PATCH: vắng mặt thì bỏ qua, có mặt thì không được null
const Present = () => ValidateIf((_, v) => v !== undefined);

const Name = () => (target: object, key: string) => {
  Trim()(target, key);
  IsString()(target, key);
  IsNotEmpty()(target, key);
  MaxLength(NAME_MAX)(target, key);
};
const OptionalText =
  (max = NAME_MAX) =>
  (target: object, key: string) => {
    TrimToNull()(target, key);
    IsOptional()(target, key);
    IsString()(target, key);
    MaxLength(max)(target, key);
  };
const SortOrder = () => (target: object, key: string) => {
  IsInt()(target, key);
  Min(-1_000_000)(target, key);
  Max(1_000_000)(target, key);
};

export class CreateCategoryDto {
  @Name() name!: string;
  @OptionalText() name_en?: string | null;
  @IsOptional() @SortOrder() sort_order?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateCategoryDto {
  @Present() @Name() name?: string;
  @OptionalText() name_en?: string | null;
  @Present() @SortOrder() sort_order?: number;
  @Present() @IsBoolean() active?: boolean;
}

export class ListCategoriesQuery {
  @IsOptional() @IsIn(['1', 'true']) all?: string;
}

class ItemFields {
  @OptionalText(40) code?: string | null;
  @OptionalText() name_en?: string | null;
  // Vắng/null do service báo UNIT_REQUIRED/IMAGE_REQUIRED thay vì VALIDATION chung
  @TrimToNull() @IsOptional() @IsIn(UNITS) unit?: string | null;
  @OptionalText() pack_note?: string | null;
  @IsOptional() @IsUUID() category_id?: string | null;
  @IsOptional() @IsUUID() image_file_id?: string | null;
  @Present() @IsBoolean() admin_only?: boolean;
  @Present() @IsInt() @Min(1) @Max(999) max_qty?: number;
  @Present() @SortOrder() sort_order?: number;
}

export class CreateItemDto extends ItemFields {
  @Name() name!: string;
}

export class UpdateItemDto extends ItemFields {
  @Present() @Name() name?: string;
  @Present() @IsBoolean() active?: boolean;
}

export class ListItemsQuery {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsOptional()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  include_inactive_ids?: string[];
}
