import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SetLocaleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(35)
  locale!: string;

  // Mã lần tải trang (ngẫu nhiên) — cùng `seq` xếp thứ tự theo LẦN BẤM, không theo lúc request tới
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  page?: string;

  // Thứ tự lần bấm trong trang (tăng dần từ 1)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  seq?: number;
}
