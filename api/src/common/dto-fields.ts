import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const NAME_MAX = 120;

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
export const Trim = () => Transform(({ value }) => trim(value));
// Chuỗi rỗng sau trim của trường tùy chọn = xóa giá trị
export const TrimToNull = () =>
  Transform(({ value }) => (trim(value) === '' ? null : trim(value)));
// PATCH: vắng mặt thì bỏ qua, có mặt thì không được null
export const Present = () => ValidateIf((_, v) => v !== undefined);

export const Name = () => (target: object, key: string) => {
  Trim()(target, key);
  IsString()(target, key);
  IsNotEmpty()(target, key);
  MaxLength(NAME_MAX)(target, key);
};
export const OptionalText =
  (max = NAME_MAX) =>
  (target: object, key: string) => {
    TrimToNull()(target, key);
    IsOptional()(target, key);
    IsString()(target, key);
    MaxLength(max)(target, key);
  };
export const SORT_ORDER_MAX = 1_000_000;

export const SortOrder = () => (target: object, key: string) => {
  IsInt()(target, key);
  Min(-SORT_ORDER_MAX)(target, key);
  Max(SORT_ORDER_MAX)(target, key);
};
