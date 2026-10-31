import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OptionalText, SortOrder } from '../catalog/catalog.dto';

export const UNIT_NAME_MAX = 40;

const UnitName = () => (target: object, key: string) => {
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )(target, key);
  IsString()(target, key);
  IsNotEmpty()(target, key);
  MaxLength(UNIT_NAME_MAX)(target, key);
};
const Present = () => ValidateIf((_, v) => v !== undefined);

export class CreateUnitDto {
  @UnitName() name!: string;
  @OptionalText(UNIT_NAME_MAX) name_en?: string | null;
  @IsOptional() @SortOrder() sort_order?: number;
}

export class UpdateUnitDto {
  @Present() @UnitName() name?: string;
  @OptionalText(UNIT_NAME_MAX) name_en?: string | null;
  @Present() @SortOrder() sort_order?: number;
  @Present() @IsBoolean() active?: boolean;
}

export class ListUnitsQuery {
  @IsOptional() @IsIn(['1', 'true']) all?: string;
}
