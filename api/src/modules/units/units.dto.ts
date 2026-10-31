import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  OptionalText,
  Present,
  SortOrder,
  Trim,
  TrimToNull,
} from '../../common/dto-fields';
import { UNIT_CODE_MAX } from './unit-code';

export const UNIT_NAME_MAX = 40;

const UnitName = () => (target: object, key: string) => {
  Trim()(target, key);
  IsString()(target, key);
  IsNotEmpty()(target, key);
  MaxLength(UNIT_NAME_MAX)(target, key);
};

// Mã ĐVT kiểm tồn tại/active ở UnitsService; vắng/null do service báo UNIT_REQUIRED
export const UnitCode = () => (target: object, key: string) => {
  TrimToNull()(target, key);
  IsOptional()(target, key);
  IsString()(target, key);
  MaxLength(UNIT_CODE_MAX)(target, key);
};

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
