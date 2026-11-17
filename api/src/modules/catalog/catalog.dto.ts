import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  Name,
  OptionalText,
  Present,
  SortOrder,
} from '../../common/dto-fields';
import { UnitCode } from '../units/units.dto';

export const uuidParam = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      code: 'VALIDATION',
      message: 'id phải là uuid.',
    }),
});

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
  @UnitCode() unit?: string | null;
  @OptionalText() pack_note?: string | null;
  @IsOptional() @IsUUID() category_id?: string | null;
  @IsOptional() @IsUUID() image_file_id?: string | null;
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
